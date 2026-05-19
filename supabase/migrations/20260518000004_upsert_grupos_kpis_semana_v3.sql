-- Corrige upsert_grupos_kpis_semana:
-- 1. no_grupo_agora = soma de total_membros das campanhas com coletar_metricas=true (valor exato e atual)
-- 2. adicionados/removidos inclui o dia de data_inicio pois grupos começam do zero a cada semana

CREATE OR REPLACE FUNCTION public.upsert_grupos_kpis_semana(p_numero int)
RETURNS void
LANGUAGE sql
AS $$
  INSERT INTO grupos_kpis_semana (numero_semana, adicionados, removidos, no_grupo_agora, synced_at)
  SELECT
    ws.numero,
    COALESCE(SUM(m.adicionados), 0)::int,
    COALESCE(SUM(m.removidos),   0)::int,
    (SELECT COALESCE(SUM(total_membros), 0)::int FROM sendflow_campanhas WHERE coletar_metricas = true),
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
$$;
