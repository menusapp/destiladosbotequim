-- Adicionar campo delivery_type na tabela orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_type TEXT DEFAULT 'delivery';