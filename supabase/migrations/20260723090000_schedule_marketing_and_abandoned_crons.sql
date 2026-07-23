-- =====================================================================
-- AUTOMAÇÃO: agenda o envio das campanhas e a marcação de carrinhos
-- abandonados (antes NENHUM invocador automático existia).
-- ---------------------------------------------------------------------
-- * marketing-scheduler: envia as mensagens agendadas cujo prazo (delay)
--   já venceu. Sem isto, as campanhas ficavam "pending" para sempre e só
--   saíam se o dono clicasse "Processar agora".
-- * process-abandoned-carts: marca como 'abandoned' as sessões paradas há
--   mais de 2h (alimenta o funil de recuperação/remarketing).
-- Mesmo padrão do cron do iFood já usado no projeto (pg_cron + pg_net +
-- net.http_post com a anon key pública no header Authorization).
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove jobs antigos (idempotente)
DO $$
DECLARE j record;
BEGIN
  FOR j IN SELECT jobid FROM cron.job
    WHERE jobname IN ('marketing-scheduler-every-min','process-abandoned-carts-15m')
  LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;

-- Envio das campanhas agendadas — a cada minuto.
SELECT cron.schedule(
  'marketing-scheduler-every-min',
  '* * * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://nrddbsudiphrvgfneqle.supabase.co/functions/v1/marketing-scheduler',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yZGRic3VkaXBocnZnZm5lcWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzMTQ3ODEsImV4cCI6MjA4MDg5MDc4MX0.MNnAmMD9ygVcsudK4GbitgbZ5UHZYJCH5Wd8ZR6HYYw'
      ),
      body := '{}'::jsonb
    );
  $cron$
);

-- Marcação de carrinhos abandonados — a cada 15 minutos.
SELECT cron.schedule(
  'process-abandoned-carts-15m',
  '*/15 * * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://nrddbsudiphrvgfneqle.supabase.co/functions/v1/process-abandoned-carts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yZGRic3VkaXBocnZnZm5lcWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzMTQ3ODEsImV4cCI6MjA4MDg5MDc4MX0.MNnAmMD9ygVcsudK4GbitgbZ5UHZYJCH5Wd8ZR6HYYw'
      ),
      body := '{}'::jsonb
    );
  $cron$
);
