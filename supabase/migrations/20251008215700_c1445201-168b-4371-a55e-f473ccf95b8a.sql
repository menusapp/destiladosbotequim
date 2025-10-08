-- Adicionar o novo status 'on_the_way' à tabela bills se ainda não existir
-- Verificar se há constraint de check no campo status e removê-la se necessário

-- Primeiro, vamos garantir que o tipo de status aceita 'on_the_way'
-- Caso exista uma constraint, precisamos recriá-la com o novo valor

DO $$ 
BEGIN
  -- Verificar se existe alguma constraint no campo status
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname LIKE '%bills_status%'
  ) THEN
    -- Remover constraints antigas se existirem
    ALTER TABLE public.bills DROP CONSTRAINT IF EXISTS bills_status_check;
  END IF;
END $$;

-- Criar nova constraint com todos os status possíveis
ALTER TABLE public.bills 
ADD CONSTRAINT bills_status_check 
CHECK (status IN ('active', 'requested', 'on_the_way', 'paid', 'cancelled'));