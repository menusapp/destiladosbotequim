-- Adicionar campo store_address na tabela delivery_config
ALTER TABLE delivery_config ADD COLUMN IF NOT EXISTS store_address TEXT;