-- ============================================================================
-- FIX: listar_semanas_trafego() — usar floor() em vez de divisão inteira
-- ============================================================================
-- BUG (2026-06-02): o seletor de Tráfego mostrava a semana 176 numa terça-feira,
-- quando a semana de tráfego corrente (Qua 27/05 → Ter 02/06) ainda era a 175.
-- A 176 do tráfego só deve começar na quarta seguinte (03/06 → 09/06).
--
-- Causa raiz: a fórmula usava divisão INTEIRA — (v_ini_atual - v_ref_ini) / 7 — que
-- TRUNCA em direção a zero. A régua de tráfego é Quarta→Terça, então nas terças a
-- "última quarta 00:00" (v_ini_atual = 27/05) fica ANTES da referência base
-- (v_ref_ini = terça 02/06, vinda de webinario_semanas, régua de captação). Isso dá
-- dias_diff = -6, e -6 / 7 = 0 em divisão inteira (deveria ser -1), deixando o número
-- do tráfego ADIANTADO em 1 semana.
--
-- Correção: floor((v_ini_atual - v_ref_ini)::numeric / 7) → floor(-6/7) = -1.
-- Captação (listar_semanas_recentes) e Vendas (listar_semanas_vendas) NÃO sofrem
-- disso porque a régua deles é terça (mesmo dia da base), então dias_diff é sempre
-- múltiplo de 7 e a divisão inteira já é exata.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.listar_semanas_trafego(p_limit integer DEFAULT 4, p_offset integer DEFAULT 0)
 RETURNS TABLE(numero integer, inicio date, fim date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
  v_dia_ini   int;
  v_hora_ini  time;
  v_dia_fim   int;
  v_num_max   int;
  v_ref_ini   date;
  v_num_atual int;
  v_ini_atual date;
  v_delta_fim int;
BEGIN
  SELECT dia_inicio, hora_inicio, dia_fim INTO v_dia_ini, v_hora_ini, v_dia_fim
  FROM semana_config WHERE entidade = 'trafego';

  SELECT ws.numero, DATE(ws.data_inicio AT TIME ZONE 'America/Sao_Paulo')
  INTO v_num_max, v_ref_ini
  FROM webinario_semanas ws ORDER BY ws.numero DESC LIMIT 1;

  v_ini_atual := ultima_ocorrencia_brt(v_dia_ini, v_hora_ini);
  -- floor() em vez de divisão inteira: corrige a contagem quando v_ini_atual < v_ref_ini
  v_num_atual := v_num_max + floor((v_ini_atual - v_ref_ini)::numeric / 7)::int;

  v_delta_fim := (v_dia_fim - v_dia_ini + 7) % 7;
  IF v_delta_fim = 0 THEN v_delta_fim := 7; END IF;

  RETURN QUERY
  SELECT
    (v_num_atual - p_offset - gs.n)::int                         AS numero,
    (v_ini_atual - ((p_offset + gs.n) * 7))::date                AS inicio,
    (v_ini_atual - ((p_offset + gs.n) * 7) + v_delta_fim)::date  AS fim
  FROM generate_series(0, p_limit - 1) AS gs(n)
  ORDER BY numero DESC;
END;
$function$;
