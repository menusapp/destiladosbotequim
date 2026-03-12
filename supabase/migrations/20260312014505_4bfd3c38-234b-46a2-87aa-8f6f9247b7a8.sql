
INSERT INTO storage.buckets (id, name, public)
VALUES ('table-images', 'table-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can read table images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'table-images');

CREATE POLICY "Authenticated can upload table images"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'table-images');

CREATE POLICY "Authenticated can delete table images"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'table-images');
