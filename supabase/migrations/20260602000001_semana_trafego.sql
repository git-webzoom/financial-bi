-- Semana própria para o Tráfego (Qua→Ter)
--
-- Contexto: o Tráfego (Meta Ads) entrega gasto/impressões só por DATA, sem hora
-- (trafego.date_ref é `date` puro). O ciclo do evento (webn) vira terça 20:00, então
-- o que foi gasto até 19:59 de terça não pertence àquela semana. Para alinhar o tráfego
-- a esse ciclo usando dias cheios, a semana de tráfego vai de QUARTA (00:00) a TERÇA (23:59).
--
-- Mantém a MESMA numeração da captação (mesma âncora: webinario_semanas), apenas deslocando
-- o início um dia (terça → quarta). NÃO altera as entidades 'captacao' nem 'webn', nem as
-- funções listar_semanas_recentes / listar_semanas_vendas (CRM, Grupos, Vendas, Webinário
-- ficam intactos).

-- 1) Nova entidade de semana exclusiva do Tráfego.
--    dia_inicio = 3 (Quarta), dia_fim = 2 (Terça). Hora é irrelevante para o tráfego
--    (date_ref é dia inteiro), mas guardamos 00:00 / 23:59 por coerência.
INSERT INTO semana_config (entidade, dia_inicio, hora_inicio, dia_fim, hora_fim)
VALUES ('trafego', 3, '00:00:00', 2, '23:59:00')
ON CONFLICT (entidade) DO UPDATE
  SET dia_inicio  = EXCLUDED.dia_inicio,
      hora_inicio = EXCLUDED.hora_inicio,
      dia_fim     = EXCLUDED.dia_fim,
      hora_fim    = EXCLUDED.hora_fim,
      updated_at  = now();

-- 2) RPC própria do Tráfego. Cópia fiel de listar_semanas_recentes, lendo a entidade
--    'trafego' em vez de 'captacao'. Mesma assinatura e mesmo shape de retorno, para o
--    frontend só trocar o nome da RPC. Reutiliza ultima_ocorrencia_brt (já existente).
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
  v_num_atual := v_num_max + ((v_ini_atual - v_ref_ini) / 7);

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
