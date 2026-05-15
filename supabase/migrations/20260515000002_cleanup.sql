-- Limpeza: remove tabelas, views e funções sem uso no frontend

-- Tabelas sem uso (ordem respeita FKs)
DROP TABLE IF EXISTS crm_historico_utm;
DROP TABLE IF EXISTS raw_grupos_wpp;
DROP TABLE IF EXISTS raw_webnario;
DROP TABLE IF EXISTS raw_assinaturas;
DROP TABLE IF EXISTS grupos_wpp;
DROP TABLE IF EXISTS webnario;
DROP TABLE IF EXISTS assinaturas;
DROP TABLE IF EXISTS import_historico;
DROP TABLE IF EXISTS integration_alerts;
DROP TABLE IF EXISTS sendflow_metricas;

-- Materialized views sem uso
DROP MATERIALIZED VIEW IF EXISTS mv_produto_performance;
DROP MATERIALIZED VIEW IF EXISTS mv_trafego_diario;
DROP MATERIALIZED VIEW IF EXISTS mv_vendas_diarias;

-- Função que só servia às materialized views
DROP FUNCTION IF EXISTS refresh_all_materialized_views();
