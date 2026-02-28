-- 1) Remover políticas antigas/conflitantes
DROP POLICY IF EXISTS "Allow authenticated inserts" ON storage.objects;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can manage fiscal certificates" ON storage.objects;
DROP POLICY IF EXISTS "fiscal_certs_select" ON storage.objects;
DROP POLICY IF EXISTS "fiscal_certs_insert" ON storage.objects;
DROP POLICY IF EXISTS "fiscal_certs_update" ON storage.objects;
DROP POLICY IF EXISTS "fiscal_certs_delete" ON storage.objects;
DROP POLICY IF EXISTS "fiscal_insert" ON storage.objects;
DROP POLICY IF EXISTS "fiscal_select" ON storage.objects;
DROP POLICY IF EXISTS "fiscal_update" ON storage.objects;
DROP POLICY IF EXISTS "fiscal_delete" ON storage.objects;

-- 2) Criar políticas definitivas para bucket privado fiscal-certificates
CREATE POLICY "fiscal_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'fiscal-certificates');

CREATE POLICY "fiscal_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'fiscal-certificates');

CREATE POLICY "fiscal_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'fiscal-certificates');

CREATE POLICY "fiscal_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'fiscal-certificates');