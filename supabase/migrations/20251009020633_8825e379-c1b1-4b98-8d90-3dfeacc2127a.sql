-- Adicionar campos de configuração na tabela restaurants
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS service_fee_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS service_fee_percentage numeric DEFAULT 10,
ADD COLUMN IF NOT EXISTS prep_time_minutes integer DEFAULT 30;

-- Remover campos relacionados ao timeout de 5 minutos da tabela bills
ALTER TABLE public.bills
DROP COLUMN IF EXISTS service_fee_removed,
DROP COLUMN IF EXISTS service_fee_removed_at,
DROP COLUMN IF EXISTS bill_requested_at;

-- Remover a função de timeout que não será mais usada
DROP FUNCTION IF EXISTS public.check_service_fee_timeout() CASCADE;

-- Remover a função mark_bill_on_the_way que não é mais necessária
DROP FUNCTION IF EXISTS public.mark_bill_on_the_way(uuid) CASCADE;