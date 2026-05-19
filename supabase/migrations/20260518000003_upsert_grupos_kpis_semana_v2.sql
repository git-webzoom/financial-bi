-- Substitui upsert_grupos_kpis_semana para usar sendflow_metricas (pull da API)
-- em vez de sendflow_eventos_grupo (webhooks, fonte não confiável).
-- Soma adicionados/removidos de todas as campanhas com coletar_metricas = true
-- cujas datas estejam dentro do período da semana (data_inicio..data_evento).

CREATE OR REPLACE FUNCTION public.upsert_grupos_kpis_semana(p_numero int)
RETURNS void
LANGUAGE sql
AS $$
  INSERT INTO grupos_kpis_semana (numero_semana, adicionados, removidos, no_grupo_agora, synced_at)
  SELECT
    ws.numero,
    COALESCE(SUM(m.adicionados), 0)::int,
    COALESCE(SUM(m.removidos),   0)::int,
    (COALESCE(SUM(m.adicionados), 0) - COALESCE(SUM(m.removidos), 0))::int,
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
