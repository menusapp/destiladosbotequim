-- Permitir upload de imagens de mesas
CREATE POLICY "Allow public upload on table-images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'table-images');

-- Permitir leitura pública de imagens de mesas
CREATE POLICY "Allow public read on table-images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'table-images');

-- Permitir atualização de imagens de mesas
CREATE POLICY "Allow public update on table-images"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'table-images');

-- Permitir deleção de imagens de mesas
CREATE POLICY "Allow public delete on table-images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'table-images');