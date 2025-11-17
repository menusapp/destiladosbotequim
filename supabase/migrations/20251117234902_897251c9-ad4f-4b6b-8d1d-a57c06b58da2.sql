-- Adicionar campos para personalização do cardápio digital
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS banner_url text;