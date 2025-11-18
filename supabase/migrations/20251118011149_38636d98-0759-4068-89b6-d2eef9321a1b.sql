-- Adicionar coluna prep_time_minutes na tabela products
ALTER TABLE products
ADD COLUMN prep_time_minutes INTEGER DEFAULT 30;