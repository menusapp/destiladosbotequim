-- Garante extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove jobs antigos se existirem
DO $$
DECLARE j record;
BEGIN
  FOR j IN SELECT jobid FROM cron.job WHERE jobname LIKE 'ifood-polling%' LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;

-- Função wrapper que dispara o polling para TODAS as configs ativas do iFood,
-- duas vezes por minuto (t=0s e t=30s) para atender ao SLA de 30s do Firefly Audit.
CREATE OR REPLACE FUNCTION public.trigger_ifood_polling_all()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg record;
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yZGRic3VkaXBocnZnZm5lcWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzMTQ3ODEsImV4cCI6MjA4MDg5MDc4MX0.MNnAmMD9ygVcsudK4GbitgbZ5UHZYJCH5Wd8ZR6HYYw';
BEGIN
  FOR cfg IN
    SELECT restaurant_id
    FROM public.ifood_config
    WHERE enabled = true
      AND merchant_id IS NOT NULL
      AND access_token IS NOT NULL
  LOOP
    PERFORM net.http_post(
      url := 'https://nrddbsudiphrvgfneqle.supabase.co/functions/v1/ifood-polling',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key
      ),
      body := jsonb_build_object('restaurant_id', cfg.restaurant_id)
    );
  END LOOP;
END;
$$;

-- Função que executa duas rodadas espaçadas em 30s dentro do mesmo minuto.
CREATE OR REPLACE FUNCTION public.cron_ifood_polling_30s()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.trigger_ifood_polling_all();
  PERFORM pg_sleep(30);
  PERFORM public.trigger_ifood_polling_all();
END;
$$;

-- Cron a cada minuto → executa 2x (t=0s e t=30s) → polling de 30 em 30 segundos.
SELECT cron.schedule(
  'ifood-polling-every-30s',
  '* * * * *',
  $cron$ SELECT public.cron_ifood_polling_30s(); $cron$
);