
-- Drop the old generic policy
DROP POLICY IF EXISTS "Authenticated users can manage fiscal certificates" ON storage.objects;

-- SELECT
CREATE POLICY "fiscal_certs_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'fiscal-certificates');

-- INSERT
CREATE POLICY "fiscal_certs_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fiscal-certificates');

-- UPDATE
CREATE POLICY "fiscal_certs_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'fiscal-certificates');

-- DELETE
CREATE POLICY "fiscal_certs_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'fiscal-certificates');
