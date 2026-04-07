
DO $$
BEGIN
  -- Check if customers is in the publication before trying to drop
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'customers' AND schemaname = 'public'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.customers;
  END IF;
END;
$$;
