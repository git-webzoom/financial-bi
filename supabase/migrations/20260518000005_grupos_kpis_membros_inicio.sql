-- Adiciona coluna para snapshot de membros no início de cada semana
ALTER TABLE grupos_kpis_semana
  ADD COLUMN IF NOT EXISTS membros_inicio_semana int NOT NULL DEFAULT 0;

-- v5: não sobrescreve membros_inicio_semana no upsert (é snapshot gravado uma vez)
CREATE OR REPLACE FUNCTION public.upsert_grupos_kpis_semana(p_numero int)
RETURNS void
LANGUAGE sql
AS $$
  INSERT INTO grupos_kpis_semana (numero_semana, adicionados, removidos, no_grupo_agora, membros_inicio_semana, synced_at)
  SELECT
    ws.numero,
    COALESCE(SUM(m.adicionados), 0)::int,
    COALESCE(SUM(m.removidos),   0)::int,
    (SELECT COALESCE(SUM(total_membros), 0)::int FROM sendflow_campanhas WHERE coletar_metricas = true),
    0,
    now()
  FROM webinario_semanas ws
  LEFT JOIN sendflow_metricas m
    ON m.data >= ws.data_inicio::date
    AND m.data <  ws.data_evento::date
    AND m.campanha_id IN (
      SELECT id FROM sendflow_campanhas WHERE coletar_metricas = true
    )
  WHERE ws.numero = p_numero
  GROUP BY ws.numero
  ON CONFLICT (numero_semana) DO UPDATE SET
    adicionados    = EXCLUDED.adicionados,
    removidos      = EXCLUDED.removidos,
    no_grupo_agora = EXCLUDED.no_grupo_agora,
    synced_at      = now();
    -- membros_inicio_semana NÃO é atualizado aqui (preserva o snapshot)
$$;

-- Função para salvar snapshot de membros no início de uma semana
CREATE OR REPLACE FUNCTION public.snapshot_membros_inicio_semana(p_numero int)
RETURNS void
LANGUAGE sql
AS $$
  INSERT INTO grupos_kpis_semana (numero_semana, adicionados, removidos, no_grupo_agora, membros_inicio_semana, synced_at)
  SELECT
    p_numero,
    0, 0,
    (SELECT COALESCE(SUM(total_membros), 0)::int FROM sendflow_campanhas WHERE coletar_metricas = true),
    (SELECT COALESCE(SUM(total_membros), 0)::int FROM sendflow_campanhas WHERE coletar_metricas = true),
    now()
  ON CONFLICT (numero_semana) DO UPDATE SET
    membros_inicio_semana = EXCLUDED.membros_inicio_semana;
$$;

-- Cron: toda terça às 23:00 UTC salva snapshot de membros no início da nova semana
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'snapshot-membros-inicio-semana') THEN
    PERFORM cron.unschedule('snapshot-membros-inicio-semana');
  END IF;
END $$;

SELECT cron.schedule(
  'snapshot-membros-inicio-semana',
  '0 23 * * 2',
  $$
  SELECT snapshot_membros_inicio_semana(
    (SELECT numero FROM webinario_semanas
     WHERE data_inicio <= now() AND data_evento > now()
     ORDER BY numero DESC LIMIT 1)
  );
  $$
);
