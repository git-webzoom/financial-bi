-- Crons para gestão automática de semanas de grupos
-- Semana encerra toda terça às 22:05 UTC

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'freeze-grupos-kpis-fim-semana') THEN
    PERFORM cron.unschedule('freeze-grupos-kpis-fim-semana');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ensure-proxima-semana') THEN
    PERFORM cron.unschedule('ensure-proxima-semana');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'snapshot-membros-inicio-semana') THEN
    PERFORM cron.unschedule('snapshot-membros-inicio-semana');
  END IF;
END $$;

-- Terça 22:01 UTC: força sync dos grupos para garantir total_membros atualizado antes do freeze
SELECT cron.schedule(
  'sync-grupos-pre-fechamento',
  '1 22 * * 2',
  $$
  SELECT net.http_post(
    url     := 'https://zbfcrnsfygovzmncmmjz.supabase.co/functions/v1/job-sendflow-grupos',
    body    := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpiZmNybnNmeWdvdnptbmNtbWp6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzk5OTc5NiwiZXhwIjoyMDkzNTc1Nzk2fQ.fjWXchVB1-dVkQBjJBXxN-4mOcF0vaP5ARtssryD804'
    )
  );
  $$
);

-- Terça 22:00 UTC: garante que a próxima semana existe
SELECT cron.schedule(
  'ensure-proxima-semana',
  '0 22 * * 2',
  $$
  SELECT ensure_semana_existe(
    (SELECT MAX(numero) + 1 FROM webinario_semanas)
  );
  $$
);

-- Terça 22:03 UTC: congela no_grupo_agora da semana atual (2 min antes do encerramento)
SELECT cron.schedule(
  'freeze-grupos-kpis-fim-semana',
  '3 22 * * 2',
  $$
  SELECT upsert_grupos_kpis_semana(
    (SELECT numero FROM webinario_semanas
     WHERE data_inicio <= now() AND data_evento > now()
     ORDER BY numero DESC LIMIT 1)
  );
  $$
);

-- Terça 22:10 UTC: snapshot de início da nova semana (5 min após encerramento)
SELECT cron.schedule(
  'snapshot-membros-inicio-semana',
  '10 22 * * 2',
  $$
  SELECT snapshot_membros_inicio_semana(
    (SELECT numero FROM webinario_semanas
     WHERE data_inicio <= now() AND data_evento > now()
     ORDER BY numero DESC LIMIT 1)
  );
  $$
);
