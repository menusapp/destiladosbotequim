-- Remover políticas restritivas existentes
DROP POLICY IF EXISTS "Admins podem gerenciar mesas de reserva" ON public.reservation_tables;
DROP POLICY IF EXISTS "Admins podem gerenciar reservas" ON public.reservations;

-- Criar políticas mais permissivas para reservation_tables
CREATE POLICY "Permitir criar mesas de reserva"
ON public.reservation_tables
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Permitir atualizar mesas de reserva"
ON public.reservation_tables
FOR UPDATE
USING (true);

CREATE POLICY "Permitir deletar mesas de reserva"
ON public.reservation_tables
FOR DELETE
USING (true);

-- Criar políticas mais permissivas para reservations
CREATE POLICY "Permitir criar reservas"
ON public.reservations
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Permitir atualizar reservas"
ON public.reservations
FOR UPDATE
USING (true);

CREATE POLICY "Permitir deletar reservas"
ON public.reservations
FOR DELETE
USING (true);

-- Criar bucket de storage para imagens de mesas
INSERT INTO storage.buckets (id, name, public)
VALUES ('reservation-tables', 'reservation-tables', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para upload de imagens
CREATE POLICY "Permitir upload de imagens de mesas"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'reservation-tables');

CREATE POLICY "Imagens de mesas são públicas"
ON storage.objects
FOR SELECT
USING (bucket_id = 'reservation-tables');

CREATE POLICY "Permitir deletar imagens de mesas"
ON storage.objects
FOR DELETE
USING (bucket_id = 'reservation-tables');