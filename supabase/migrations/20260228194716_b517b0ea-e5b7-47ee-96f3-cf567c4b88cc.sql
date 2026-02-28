
DROP POLICY IF EXISTS "fiscal_insert" ON storage.objects;
DROP POLICY IF EXISTS "fiscal_select" ON storage.objects;
DROP POLICY IF EXISTS "fiscal_update" ON storage.objects;
DROP POLICY IF EXISTS "fiscal_delete" ON storage.objects;

CREATE POLICY "fiscal_insert" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'fiscal-certificates');
CREATE POLICY "fiscal_select" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'fiscal-certificates');
CREATE POLICY "fiscal_update" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'fiscal-certificates');
CREATE POLICY "fiscal_delete" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'fiscal-certificates');
