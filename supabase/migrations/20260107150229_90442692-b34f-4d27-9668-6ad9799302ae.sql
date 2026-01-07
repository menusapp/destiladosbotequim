-- Adicionar campo para seguir horário de funcionamento nas reservas
ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS reservations_follow_business_hours BOOLEAN DEFAULT true;