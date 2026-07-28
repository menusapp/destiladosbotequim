-- =====================================================================
-- CORREÇÃO CRÍTICA: os cron jobs apontavam para o PROJETO SUPABASE ERRADO
-- ---------------------------------------------------------------------
-- O código herdado do Menu's SaaS trazia a referência fixa do projeto antigo
-- (nrddbsudiphrvgfneqle). Este projeto é `ksscrxwvslddfqxjxzlo`. Como os
-- agendamentos chamavam as edge functions no domínio antigo, NADA rodava:
--   * campanhas agendadas nunca eram enviadas;
--   * carrinhos abandonados nunca eram marcados;
--   * gatilhos por ausência nunca disparavam;
--   * polling do iFood batia num projeto morto.
-- Reagenda tudo apontando para o projeto correto. Idempotente.
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove os jobs antigos (qualquer URL) antes de recriar
DO $$
DECLARE j record;
BEGIN
  FOR j IN
    SELECT jobid FROM cron.job
    WHERE jobname IN (
      'marketing-scheduler-every-min',
      'process-abandoned-carts-15m',
      'marketing-absence-scanner-10m',
      'ifood-polling-every-30s'
    )
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
      url := 'https://ksscrxwvslddfqxjxzlo.supabase.co/functions/v1/marketing-scheduler',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'sb_publishable_Ur3NJvcsw2G8F65DniEXBw_tfEc2ypP'
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
      url := 'https://ksscrxwvslddfqxjxzlo.supabase.co/functions/v1/process-abandoned-carts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'sb_publishable_Ur3NJvcsw2G8F65DniEXBw_tfEc2ypP'
      ),
      body := '{}'::jsonb
    );
  $cron$
);

-- Gatilhos por ausência (carrinho abandonado / inativo / nunca comprou) — 10 min.
SELECT cron.schedule(
  'marketing-absence-scanner-10m',
  '*/10 * * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://ksscrxwvslddfqxjxzlo.supabase.co/functions/v1/marketing-absence-scanner',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'sb_publishable_Ur3NJvcsw2G8F65DniEXBw_tfEc2ypP'
      ),
      body := '{}'::jsonb
    );
  $cron$
);

-- Polling do iFood: mesma correção de projeto (a função fixava o domínio antigo).
CREATE OR REPLACE FUNCTION public.trigger_ifood_polling_all()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg record;
BEGIN
  FOR cfg IN
    SELECT restaurant_id
    FROM public.ifood_config
    WHERE enabled = true
      AND merchant_id IS NOT NULL
      AND access_token IS NOT NULL
  LOOP
    PERFORM net.http_post(
      url := 'https://ksscrxwvslddfqxjxzlo.supabase.co/functions/v1/ifood-polling',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'sb_publishable_Ur3NJvcsw2G8F65DniEXBw_tfEc2ypP'
      ),
      body := jsonb_build_object('restaurant_id', cfg.restaurant_id)
    );
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'ifood-polling-every-30s',
  '* * * * *',
  $cron$ SELECT public.cron_ifood_polling_30s(); $cron$
);
