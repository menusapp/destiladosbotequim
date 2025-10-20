-- Adicionar coluna para % CMV desejada nas configurações
ALTER TABLE public.restaurants
ADD COLUMN target_cmv_percentage numeric DEFAULT 30 CHECK (target_cmv_percentage >= 0 AND target_cmv_percentage <= 100);