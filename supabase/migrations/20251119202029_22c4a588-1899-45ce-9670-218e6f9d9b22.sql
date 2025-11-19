-- Adicionar coluna cpf na tabela profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cpf TEXT;

-- Criar índice para busca rápida por CPF
CREATE INDEX IF NOT EXISTS idx_profiles_cpf ON profiles(cpf);