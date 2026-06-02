-- Lead Score WEBN — RPC de leitura em lote para o /crm (Fase 6)
--
-- Mesmo padrão de get_outras_semanas_contatos: recebe array de uuid via POST,
-- evitando o estouro de URL do .in() com muitos ids (lição do get_compradores_semana).
-- Retorna só os contatos que TÊM score; os sem score não vêm (badge "—" no front).

CREATE OR REPLACE FUNCTION get_lead_scores(p_contato_ids uuid[])
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT json_agg(row_to_json(t))
  FROM (
    SELECT contato_id, pontos_total, faixa
    FROM lead_score
    WHERE contato_id = ANY(p_contato_ids)
  ) t;
$function$;
