-- ============================================================
-- Views Materializadas
-- ============================================================

-- ------------------------------------------------------------
-- mv_vendas_diarias
-- ------------------------------------------------------------
CREATE MATERIALIZED VIEW mv_vendas_diarias AS
SELECT
  data_aprovacao::date                                                       AS data,
  COUNT(*)    FILTER (WHERE status = 'approved')                             AS total_vendas,
  COALESCE(SUM(valor_venda)   FILTER (WHERE status = 'approved'), 0)         AS faturamento_bruto,
  COALESCE(SUM(valor_liquido) FILTER (WHERE status = 'approved'), 0)         AS faturamento_liquido,
  CASE
    WHEN COUNT(*) FILTER (WHERE status = 'approved') > 0
    THEN ROUND(
      SUM(valor_venda) FILTER (WHERE status = 'approved') /
      COUNT(*)         FILTER (WHERE status = 'approved'),
      2
    )
    ELSE 0
  END                                                                        AS ticket_medio,
  COUNT(*)    FILTER (WHERE status = 'refunded')                             AS total_reembolsos,
  COUNT(*)    FILTER (WHERE status = 'chargeback')                           AS total_chargebacks
FROM vendas
WHERE data_aprovacao IS NOT NULL
GROUP BY data_aprovacao::date
WITH DATA;

CREATE UNIQUE INDEX ON mv_vendas_diarias(data);

-- ------------------------------------------------------------
-- mv_trafego_diario
-- ------------------------------------------------------------
CREATE MATERIALIZED VIEW mv_trafego_diario AS
SELECT
  date_ref,
  campaign_name,
  SUM(amount_spent)                                                          AS total_investido,
  SUM(impressions)                                                           AS impressions,
  SUM(link_clicks)                                                           AS link_clicks,
  SUM(leads)                                                                 AS leads,
  SUM(purchases)                                                             AS purchases,
  ROUND(
    CASE WHEN SUM(impressions) > 0
    THEN (SUM(amount_spent) / SUM(impressions)) * 1000 END,
    4
  )                                                                          AS cpm,
  ROUND(
    CASE WHEN SUM(impressions) > 0
    THEN (SUM(link_clicks)::numeric / SUM(impressions)) * 100 END,
    4
  )                                                                          AS ctr,
  ROUND(SUM(amount_spent) / NULLIF(SUM(leads),     0), 2)                   AS cpl,
  ROUND(SUM(amount_spent) / NULLIF(SUM(purchases), 0), 2)                   AS cpa
FROM trafego
GROUP BY date_ref, campaign_name
WITH DATA;

CREATE UNIQUE INDEX ON mv_trafego_diario(date_ref, campaign_name);

-- ------------------------------------------------------------
-- mv_produto_performance
-- ------------------------------------------------------------
CREATE MATERIALIZED VIEW mv_produto_performance AS
SELECT
  v.produto_id,
  v.oferta_id,
  p.nome                                                                     AS nome_produto,
  o.nome                                                                     AS nome_oferta,
  o.funil,
  COUNT(*)    FILTER (WHERE v.status = 'approved')                           AS total_vendas,
  COALESCE(SUM(v.valor_venda)   FILTER (WHERE v.status = 'approved'), 0)     AS faturamento_bruto,
  COALESCE(SUM(v.valor_liquido) FILTER (WHERE v.status = 'approved'), 0)     AS faturamento_liquido,
  CASE
    WHEN COUNT(*) FILTER (WHERE v.status = 'approved') > 0
    THEN ROUND(
      SUM(v.valor_venda) FILTER (WHERE v.status = 'approved') /
      COUNT(*)           FILTER (WHERE v.status = 'approved'),
      2
    )
    ELSE 0
  END                                                                        AS ticket_medio
FROM vendas v
LEFT JOIN produtos p ON p.id = v.produto_id
LEFT JOIN ofertas  o ON o.id = v.oferta_id
GROUP BY v.produto_id, v.oferta_id, p.nome, o.nome, o.funil
WITH DATA;

CREATE UNIQUE INDEX ON mv_produto_performance(produto_id, oferta_id);

-- ------------------------------------------------------------
-- refresh_all_materialized_views
-- Chamada após cada ingestão de dados.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_vendas_diarias;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_trafego_diario;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_produto_performance;
END;
$$;
