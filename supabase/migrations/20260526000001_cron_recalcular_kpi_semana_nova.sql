-- Terça 22:15 UTC: recalcula KPI da semana nova após grupos serem atualizados
-- O sync de grupos roda às 22:01 UTC e pode demorar alguns minutos;
-- esse cron garante que no_grupo_agora reflita os membros reais da nova semana

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'recalcular-kpi-semana-nova') THEN
    PERFORM cron.unschedule('recalcular-kpi-semana-nova');
  END IF;
END $$;

SELECT cron.schedule(
  'recalcular-kpi-semana-nova',
  '15 22 * * 2',
  $$
  SELECT upsert_grupos_kpis_semana(
    (SELECT numero FROM webinario_semanas
     WHERE data_inicio <= now() AND data_evento > now()
     ORDER BY numero DESC LIMIT 1)
  );
  $$
);
