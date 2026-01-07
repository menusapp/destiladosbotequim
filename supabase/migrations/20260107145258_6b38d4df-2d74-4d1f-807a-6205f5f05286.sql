-- Criar bucket para imagens de mesas (as políticas já existem)
INSERT INTO storage.buckets (id, name, public)
VALUES ('table-images', 'table-images', true);