
-- Passo 1: Corrigir default do provider na tabela online_payments
ALTER TABLE public.online_payments ALTER COLUMN provider SET DEFAULT 'asaas';

-- Adicionar coluna payment_status na tabela orders (para rastrear pagamento online)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS online_payment_id uuid;
