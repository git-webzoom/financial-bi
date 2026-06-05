-- RPC que agrega o tráfego POR ANÚNCIO para as abas venda_direta (TPW/Desafio/futuras).
-- Recebe o período (date) e as regras do filtro de tráfego da aba como JSONB
-- (mesmo formato de filtros_personalizados_regras: [{campo, operador, valor, ordem}]).
-- Aplica as regras de forma genérica (espelha lib/filtros-personalizados.ts → aplicarRegras),
-- usando SOMENTE os operadores do enum (sem SQL injection: campo é validado contra whitelist,
-- valor entra por parâmetro via format %L / quote_literal).
--
-- Retorna 1 linha por anúncio (ad_name) com tudo já calculado:
--   tipo: 'video' se houver video_views_3s ou video_watches_75 > 0, senão 'imagem'
--   gasto, impressoes, cpm
--   hook_rate  = video_views_3s / impressions        (NULL p/ imagem)
--   hold_rate  = video_watches_75 / video_views_3s    (NULL p/ imagem)
--   click_rate = vídeo: link_clicks / video_watches_75 ; imagem: link_clicks / impressions (CTR)
--   link_clicks, checkouts_initiated, video_views_3s, video_watches_75 (cru, p/ o front se precisar)
CREATE OR REPLACE FUNCTION public.get_trafego_ads_aba(
  p_inicio date,
  p_fim    date,
  p_regras jsonb DEFAULT '[]'::jsonb
)
RETURNS TABLE (
  ad_name            text,
  ad_id              text,
  tipo               text,
  gasto              numeric,
  impressoes         bigint,
  cpm                numeric,
  hook_rate          numeric,
  hold_rate          numeric,
  click_rate         numeric,
  link_clicks        bigint,
  checkouts_initiated bigint,
  video_views_3s     bigint,
  video_watches_75   bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_where   text := '';
  v_regra   jsonb;
  v_campo   text;
  v_oper    text;
  v_valor   text;
  v_campos_validos constant text[] := ARRAY['campaign_name','adset_name','ad_name','ad_account_id'];
  v_sql     text;
BEGIN
  -- Monta o WHERE dinâmico das regras (mesma semântica de aplicarRegras no front)
  FOR v_regra IN SELECT * FROM jsonb_array_elements(COALESCE(p_regras, '[]'::jsonb))
  LOOP
    v_campo := v_regra->>'campo';
    v_oper  := v_regra->>'operador';
    v_valor := COALESCE(v_regra->>'valor', '');

    -- Whitelist de campo: ignora regra inválida (segurança)
    IF v_campo IS NULL OR NOT (v_campo = ANY (v_campos_validos)) THEN
      CONTINUE;
    END IF;

    v_where := v_where || ' AND ' || CASE v_oper
      WHEN 'contem'      THEN format('%I ILIKE %L', v_campo, '%' || v_valor || '%')
      WHEN 'nao_contem'  THEN format('(%I IS NULL OR %I NOT ILIKE %L)', v_campo, v_campo, '%' || v_valor || '%')
      WHEN 'igual'       THEN format('%I = %L', v_campo, v_valor)
      WHEN 'comeca_com'  THEN format('%I ILIKE %L', v_campo, v_valor || '%')
      -- operadores numéricos não fazem sentido em colunas text de tráfego, mas cobrimos por completude
      WHEN 'maior_que'   THEN format('%I > %L', v_campo, v_valor)
      WHEN 'maior_igual' THEN format('%I >= %L', v_campo, v_valor)
      WHEN 'menor_que'   THEN format('(%I < %L OR %I IS NULL)', v_campo, v_valor, v_campo)
      WHEN 'menor_igual' THEN format('(%I <= %L OR %I IS NULL)', v_campo, v_valor, v_campo)
      ELSE 'TRUE'
    END;
  END LOOP;

  v_sql := format($q$
    SELECT
      t.ad_name,
      MAX(t.ad_id) AS ad_id,
      CASE WHEN SUM(COALESCE(t.video_views_3s,0)) > 0 OR SUM(COALESCE(t.video_watches_75,0)) > 0
           THEN 'video' ELSE 'imagem' END AS tipo,
      ROUND(COALESCE(SUM(t.amount_spent),0), 2) AS gasto,
      COALESCE(SUM(t.impressions),0)::bigint AS impressoes,
      ROUND(COALESCE(SUM(t.amount_spent),0) / NULLIF(SUM(t.impressions),0) * 1000, 2) AS cpm,
      ROUND(SUM(t.video_views_3s)::numeric   / NULLIF(SUM(t.impressions),0),     4) AS hook_rate,
      ROUND(SUM(t.video_watches_75)::numeric / NULLIF(SUM(t.video_views_3s),0),  4) AS hold_rate,
      CASE
        WHEN SUM(COALESCE(t.video_views_3s,0)) > 0 OR SUM(COALESCE(t.video_watches_75,0)) > 0
          THEN ROUND(SUM(t.link_clicks)::numeric / NULLIF(SUM(t.video_watches_75),0), 4)
        ELSE ROUND(SUM(t.link_clicks)::numeric / NULLIF(SUM(t.impressions),0), 4)
      END AS click_rate,
      COALESCE(SUM(t.link_clicks),0)::bigint AS link_clicks,
      COALESCE(SUM(t.checkouts_initiated),0)::bigint AS checkouts_initiated,
      COALESCE(SUM(t.video_views_3s),0)::bigint AS video_views_3s,
      COALESCE(SUM(t.video_watches_75),0)::bigint AS video_watches_75
    FROM trafego t
    WHERE t.date_ref >= %L AND t.date_ref <= %L
      %s
    GROUP BY t.ad_name
    HAVING COALESCE(SUM(t.amount_spent),0) > 0 OR COALESCE(SUM(t.impressions),0) > 0
    ORDER BY SUM(t.amount_spent) DESC NULLS LAST
  $q$, p_inicio, p_fim, v_where);

  RETURN QUERY EXECUTE v_sql;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_trafego_ads_aba(date, date, jsonb) FROM PUBLIC;
-- Política do projeto: dados de tráfego só para usuário logado. O default privilege do projeto
-- concede EXECUTE a anon automaticamente (após o REVOKE acima) — revogamos explicitamente.
REVOKE EXECUTE ON FUNCTION public.get_trafego_ads_aba(date, date, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_trafego_ads_aba(date, date, jsonb) TO authenticated;
