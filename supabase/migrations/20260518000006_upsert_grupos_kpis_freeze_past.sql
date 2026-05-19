-- v6: não sobrescreve no_grupo_agora de semanas que já encerraram
CREATE OR REPLACE FUNCTION public.upsert_grupos_kpis_semana(p_numero int)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_semana_atual int;
BEGIN
  SELECT numero INTO v_semana_atual
  FROM webinario_semanas
  WHERE data_inicio <= now() AND data_evento > now()
  ORDER BY numero DESC
  LIMIT 1;

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
    no_grupo_agora = CASE
      WHEN grupos_kpis_semana.numero_semana = v_semana_atual THEN EXCLUDED.no_grupo_agora
      ELSE grupos_kpis_semana.no_grupo_agora
    END,
    synced_at      = now();
END;
$$;
