-- Lead Score — distribuição por nota dos captados de UMA semana (para o gráfico da aba
-- Webinário do /dashboard).
--
-- Cruza os captados/inscritos da semana (webinario_inscritos.numero_semana, mesma fonte que o
-- /crm usa via get_inscritos_semana) com lead_score por contato_id. lead_score é por PESSOA
-- (não tem numero_semana) — o recorte de semana vem dos inscritos. faixa NULL = captado que NÃO
-- preencheu a pesquisa (entra em sem_resposta, fora das barras de nota).
--
-- Retorna pronto para o gráfico:
--   { total_captados, preencheram, sem_resposta, faixas: { "A+","A","B","C","D" } }

CREATE OR REPLACE FUNCTION get_lead_score_distribuicao_semana(p_numero integer)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT ls.faixa
    FROM webinario_inscritos wi
    LEFT JOIN lead_score ls ON ls.contato_id = wi.contato_id
    WHERE wi.numero_semana = p_numero
  )
  SELECT json_build_object(
    'total_captados', count(*),
    'preencheram',    count(faixa),
    'sem_resposta',   count(*) FILTER (WHERE faixa IS NULL),
    'faixas', json_build_object(
      'A+', count(*) FILTER (WHERE faixa = 'A+'),
      'A',  count(*) FILTER (WHERE faixa = 'A'),
      'B',  count(*) FILTER (WHERE faixa = 'B'),
      'C',  count(*) FILTER (WHERE faixa = 'C'),
      'D',  count(*) FILTER (WHERE faixa = 'D')
    )
  )
  FROM base;
$function$;
