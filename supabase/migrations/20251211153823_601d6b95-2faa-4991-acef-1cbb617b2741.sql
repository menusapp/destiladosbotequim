-- Políticas RLS para o bucket product-images

-- Política para permitir leitura pública (imagens de produtos são públicas)
CREATE POLICY "Allow public read access on product-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- Política para permitir upload por qualquer usuário (restaurante usa autenticação própria)
CREATE POLICY "Allow public upload on product-images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-images');

-- Política para permitir atualização
CREATE POLICY "Allow public update on product-images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-images');

-- Política para permitir deleção
CREATE POLICY "Allow public delete on product-images"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-images');