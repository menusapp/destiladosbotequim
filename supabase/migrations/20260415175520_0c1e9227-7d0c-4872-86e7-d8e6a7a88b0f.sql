INSERT INTO storage.buckets (id, name, public) VALUES ('products', 'products', true);

CREATE POLICY "Anyone can view product images" ON storage.objects FOR SELECT USING (bucket_id = 'products');

CREATE POLICY "Authenticated or anon can upload product images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'products');

CREATE POLICY "Authenticated or anon can update product images" ON storage.objects FOR UPDATE USING (bucket_id = 'products');

CREATE POLICY "Authenticated or anon can delete product images" ON storage.objects FOR DELETE USING (bucket_id = 'products');