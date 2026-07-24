-- =====================================================================
-- AUTOMAÇÃO: agenda o scanner de gatilhos por ausência (carrinho
-- abandonado / cliente inativo / nunca comprou), que alimenta as
-- campanhas de remarketing baseadas no funil.
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE j record;
BEGIN
  FOR j IN SELECT jobid FROM cron.job WHERE jobname = 'marketing-absence-scanner-10m' LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;

-- A cada 10 minutos: varre ausências e agenda as mensagens correspondentes.
SELECT cron.schedule(
  'marketing-absence-scanner-10m',
  '*/10 * * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://nrddbsudiphrvgfneqle.supabase.co/functions/v1/marketing-absence-scanner',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yZGRic3VkaXBocnZnZm5lcWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzMTQ3ODEsImV4cCI6MjA4MDg5MDc4MX0.MNnAmMD9ygVcsudK4GbitgbZ5UHZYJCH5Wd8ZR6HYYw'
      ),
      body := '{}'::jsonb
    );
  $cron$
);
