-- Extensões necessárias (já instaladas no projeto)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove crons anteriores se existirem (idempotente)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sendflow-metricas-daily') THEN
    PERFORM cron.unschedule('sendflow-metricas-daily');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sendflow-metricas-lookback') THEN
    PERFORM cron.unschedule('sendflow-metricas-lookback');
  END IF;
END $$;

-- A cada 15 minutos: busca dados de hoje
SELECT cron.schedule(
  'sendflow-metricas-daily',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://zbfcrnsfygovzmncmmjz.supabase.co/functions/v1/job-sendflow-metricas',
    body    := '{"mode":"daily"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpiZmNybnNmeWdvdnptbmNtbWp6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk5OTc5NiwiZXhwIjoyMDkzNTc1Nzk2fQ.fjWXchVB1-dVkQBjJBXxN-4mOcF0vaP5ARtssryD804'
    )
  );
  $$
);

-- Todo dia às 03:00 UTC: busca últimos 5 dias
SELECT cron.schedule(
  'sendflow-metricas-lookback',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://zbfcrnsfygovzmncmmjz.supabase.co/functions/v1/job-sendflow-metricas',
    body    := '{"mode":"lookback"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpiZmNybnNmeWdvdnptbmNtbWp6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk5OTc5NiwiZXhwIjoyMDkzNTc1Nzk2fQ.fjWXchVB1-dVkQBjJBXxN-4mOcF0vaP5ARtssryD804'
    )
  );
  $$
);
