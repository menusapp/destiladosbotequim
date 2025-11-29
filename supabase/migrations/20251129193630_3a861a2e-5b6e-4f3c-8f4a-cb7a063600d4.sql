-- Adicionar campo pickup_time_minutes na tabela restaurants
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS pickup_time_minutes INTEGER DEFAULT 15;

COMMENT ON COLUMN public.restaurants.pickup_time_minutes IS 'Tempo estimado em minutos para pedidos de retirada (pickup)';