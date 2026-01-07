-- Remover FK que referencia reservation_tables (tabela antiga)
ALTER TABLE reservations 
DROP CONSTRAINT IF EXISTS reservations_reservation_table_id_fkey;

-- Tornar reservation_table_id nullable (para compatibilidade)
ALTER TABLE reservations 
ALTER COLUMN reservation_table_id DROP NOT NULL;

-- Habilitar realtime para reservas
ALTER PUBLICATION supabase_realtime ADD TABLE reservations;

-- Garantir que mudanças completas sejam capturadas
ALTER TABLE reservations REPLICA IDENTITY FULL;