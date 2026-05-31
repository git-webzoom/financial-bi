-- ============================================================
-- HABILITAR RLS NAS 5 TABELAS EXPOSTAS
-- ============================================================
-- Estas tabelas estavam SEM Row Level Security → expostas à anon key.
-- Quem ESCREVE nelas usa service_role (Edge Functions / webhook) ou roda
-- como superuser (cron SQL) — ambos bypassam RLS, então habilitar RLS
-- com as policies abaixo NÃO afeta nenhum job/cron/trigger/webhook.
-- Quem LÊ no frontend (autenticado): /grupos (grupos_kpis_semana) e
-- /webnario (webinario_presencas). As outras 3 não são lidas no front.
--
-- Padrão idêntico ao já usado em crm/trafego:
--   SELECT  -> authenticated USING (true)
--   INSERT/UPDATE/DELETE -> service_role (documenta a intenção; service_role
--   já bypassa RLS, mas impede escrita por authenticated/anon).

-- ── grupos_kpis_semana ─────────────────────────────────────
ALTER TABLE grupos_kpis_semana ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "grupos_kpis_select"        ON grupos_kpis_semana;
DROP POLICY IF EXISTS "grupos_kpis_write_service" ON grupos_kpis_semana;
CREATE POLICY "grupos_kpis_select" ON grupos_kpis_semana
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "grupos_kpis_write_service" ON grupos_kpis_semana
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── sendflow_metricas ──────────────────────────────────────
ALTER TABLE sendflow_metricas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sendflow_metricas_select"        ON sendflow_metricas;
DROP POLICY IF EXISTS "sendflow_metricas_write_service" ON sendflow_metricas;
CREATE POLICY "sendflow_metricas_select" ON sendflow_metricas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "sendflow_metricas_write_service" ON sendflow_metricas
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── webinario_presencas ────────────────────────────────────
ALTER TABLE webinario_presencas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webinario_presencas_select"        ON webinario_presencas;
DROP POLICY IF EXISTS "webinario_presencas_write_service" ON webinario_presencas;
CREATE POLICY "webinario_presencas_select" ON webinario_presencas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "webinario_presencas_write_service" ON webinario_presencas
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── crm_historico_utm ──────────────────────────────────────
ALTER TABLE crm_historico_utm ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_historico_utm_select"        ON crm_historico_utm;
DROP POLICY IF EXISTS "crm_historico_utm_write_service" ON crm_historico_utm;
CREATE POLICY "crm_historico_utm_select" ON crm_historico_utm
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_historico_utm_write_service" ON crm_historico_utm
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── sendflow_eventos_grupo ─────────────────────────────────
ALTER TABLE sendflow_eventos_grupo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sendflow_eventos_grupo_select"        ON sendflow_eventos_grupo;
DROP POLICY IF EXISTS "sendflow_eventos_grupo_write_service" ON sendflow_eventos_grupo;
CREATE POLICY "sendflow_eventos_grupo_select" ON sendflow_eventos_grupo
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "sendflow_eventos_grupo_write_service" ON sendflow_eventos_grupo
  FOR ALL TO service_role USING (true) WITH CHECK (true);
