INSERT INTO storage.buckets (id, name, public) VALUES ('backups', 'backups', false);

CREATE POLICY "Restaurant can manage own backups"
ON storage.objects FOR ALL
TO anon, authenticated
USING (bucket_id = 'backups')
WITH CHECK (bucket_id = 'backups');