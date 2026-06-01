-- listar_semanas_vendas: respeitar o corte de HORA da entidade 'webn'
--
-- Motivo: o seletor de "Semana" da aba Vendas (e o card de vendas do Dashboard)
-- resolvia o período usando apenas DATA (00:00 -> 23:59), ignorando o corte real
-- configurado em semana_config (webn = terça 20:00 -> terça 19:59). Isso classificava
-- na semana errada as vendas feitas entre 00:00 e o horário de corte da terça.
--
-- Correção: além de numero/inicio/fim (date), a função passa a devolver inicio_ts/fim_ts
-- (timestamptz) já com a hora do corte, lendo hora_inicio/hora_fim de semana_config('webn')
-- em America/Sao_Paulo. O frontend filtra vendas.data_pedido por esses timestamps.
--
-- IMPORTANTE: a defasagem de numeração (o "- 1") é PROPOSITAL — Vendas/Webinário ficam
-- "uma semana pra trás" em número. NÃO é alterada aqui.
--
-- Drift conhecido: a migration 20260521000001 versiona semana_config com 20:00/19:59,
-- mas o banco real hoje tem captacao=19:30/19:29 e webn=20:00/19:59 (ajustado pela tela
-- de Configurações). A fonte da verdade é o banco; semana_config NÃO é tocada aqui.

-- Mudar o RETURNS TABLE exige recriar a função (Postgres não troca o tipo de retorno
-- num CREATE OR REPLACE). Nenhuma outra função SQL referencia esta RPC; só 3 call sites
-- no frontend, que usam o objeto inteiro (select *), então o DROP é seguro.
DROP FUNCTION IF EXISTS public.listar_semanas_vendas(integer);

CREATE OR REPLACE FUNCTION public.listar_semanas_vendas(p_limit integer DEFAULT 4)
 RETURNS TABLE(
   numero    integer,
   inicio    date,
   fim       date,
   inicio_ts timestamptz,
   fim_ts    timestamptz
 )
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
  v_num_atual int;
  v_ini_atual date;
  v_delta_fim int;
BEGIN
  SELECT dia_inicio, hora_inicio, dia_fim, hora_fim
    INTO v_dia_ini, v_hora_ini, v_dia_fim, v_hora_fim
  FROM semana_config WHERE entidade = 'webn';

  SELECT ws.numero, DATE(ws.data_inicio AT TIME ZONE 'America/Sao_Paulo')
  INTO v_num_max, v_ref_ini
  FROM webinario_semanas ws ORDER BY ws.numero DESC LIMIT 1;

  v_ini_atual := ultima_ocorrencia_brt(v_dia_ini, v_hora_ini);
  -- "- 1" PROPOSITAL: Vendas/Webinário ficam uma semana pra trás em número.
  v_num_atual := (v_num_max + ((v_ini_atual - v_ref_ini) / 7)) - 1;

  v_delta_fim := (v_dia_fim - v_dia_ini + 7) % 7;
  IF v_delta_fim = 0 THEN v_delta_fim := 7; END IF;

  RETURN QUERY
  SELECT
    (v_num_atual - gs.n)::int                                                          AS numero,
    (v_ini_atual - (gs.n * 7))::date                                                   AS inicio,
    (v_ini_atual - (gs.n * 7) + v_delta_fim)::date                                     AS fim,
    -- timestamps com o corte real (hora de semana_config 'webn'), interpretados em BRT
    (((v_ini_atual - (gs.n * 7))::text || ' ' || v_hora_ini::text)::timestamp
        AT TIME ZONE 'America/Sao_Paulo')                                              AS inicio_ts,
    (((v_ini_atual - (gs.n * 7) + v_delta_fim)::text || ' ' || v_hora_fim::text)::timestamp
        AT TIME ZONE 'America/Sao_Paulo')                                              AS fim_ts
  FROM generate_series(0, p_limit - 1) AS gs(n)
  ORDER BY numero DESC;
END;
$function$;
