-- ============================================================================
-- get_periodo_semana ganha p_entidade — período do Webinário/Vendas CALCULADO
-- ============================================================================
-- Default 'captacao' = comportamento ORIGINAL (lê webinario_semanas), CRM intacto.
-- 'webn' = calcula o período pela régua de vendas/webinário (mesma matemática de
-- listar_semanas_vendas), eliminando a dependência da tabela física
-- webinario_semanas_presencas. data_evento = data_inicio (ao vivo terça 20:00 BRT).
--
-- IMPORTANTE: a versão antiga get_periodo_semana(integer) é dropada na migration
-- 20260602000009 para evitar ambiguidade (erro 42725) nas chamadas de 1 argumento.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_periodo_semana(
  p_numero   integer,
  p_entidade text DEFAULT 'captacao'
)
 RETURNS TABLE(data_inicio timestamptz, data_fim timestamptz, data_evento timestamptz)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
  v_dia_ini   int;
  v_hora_ini  time;
  v_dia_fim   int;
  v_hora_fim  time;
  v_num_max   int;
  v_ref_ini   date;
  v_ini_atual date;
  v_num_atual int;
  v_delta_fim int;
  v_offset    int;
  v_ini_date  date;
  v_fim_date  date;
  v_ini_ts    timestamptz;
  v_fim_ts    timestamptz;
BEGIN
  IF p_entidade = 'webn' THEN
    SELECT dia_inicio, hora_inicio, dia_fim, hora_fim
      INTO v_dia_ini, v_hora_ini, v_dia_fim, v_hora_fim
    FROM semana_config WHERE entidade = 'webn';

    SELECT ws.numero, DATE(ws.data_inicio AT TIME ZONE 'America/Sao_Paulo')
      INTO v_num_max, v_ref_ini
    FROM webinario_semanas ws ORDER BY ws.numero DESC LIMIT 1;

    IF v_num_max IS NULL THEN
      RETURN;
    END IF;

    v_ini_atual := ultima_ocorrencia_brt(v_dia_ini, v_hora_ini);
    v_num_atual := (v_num_max + ((v_ini_atual - v_ref_ini) / 7)) - 1;

    v_delta_fim := (v_dia_fim - v_dia_ini + 7) % 7;
    IF v_delta_fim = 0 THEN v_delta_fim := 7; END IF;

    v_offset   := v_num_atual - p_numero;
    v_ini_date := v_ini_atual - (v_offset * 7);
    v_fim_date := v_ini_date + v_delta_fim;

    v_ini_ts := ((v_ini_date::text || ' ' || v_hora_ini::text)::timestamp AT TIME ZONE 'America/Sao_Paulo');
    v_fim_ts := ((v_fim_date::text || ' ' || v_hora_fim::text)::timestamp AT TIME ZONE 'America/Sao_Paulo');

    RETURN QUERY SELECT v_ini_ts, v_fim_ts, v_ini_ts;
    RETURN;
  END IF;

  -- Caminho 'captacao' (default): comportamento ORIGINAL.
  RETURN QUERY
  SELECT ws.data_inicio, ws.data_fim, ws.data_evento
  FROM webinario_semanas ws
  WHERE ws.numero = p_numero
  UNION ALL
  SELECT wsp.data_inicio, wsp.data_fim, wsp.data_evento
  FROM webinario_semanas_presencas wsp
  WHERE wsp.numero = p_numero
    AND NOT EXISTS (SELECT 1 FROM webinario_semanas w2 WHERE w2.numero = p_numero)
  LIMIT 1;
END;
$function$;
