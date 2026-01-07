-- Adicionar templates de mensagem para reservas na tabela whatsapp_config
ALTER TABLE whatsapp_config
ADD COLUMN IF NOT EXISTS message_reservation_created TEXT,
ADD COLUMN IF NOT EXISTS message_reservation_confirmed TEXT,
ADD COLUMN IF NOT EXISTS message_reservation_cancelled TEXT;