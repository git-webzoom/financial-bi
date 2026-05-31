-- ============================================================
-- ABAS DINÂMICAS DO DASHBOARD
-- ============================================================
-- Cada aba do dashboard passa a ser configurável (página de Configurações).
-- A aba tem um TIPO DE MOCKUP (template) e vínculos a filtros já existentes
-- em filtros_personalizados, cada vínculo com um "papel" (role).
--   - venda_direta: usa papéis 'trafego' e 'vendas' (é o dash TPW atual)
--   - captacao:     FUTURO (papéis novos: leads_tag, sendflow, ...)
-- A aba "Webnário" do dashboard é caso à parte e NÃO entra nestas tabelas.

CREATE TABLE dashboard_abas (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text        NOT NULL,
  tipo_mockup text        NOT NULL CHECK (tipo_mockup IN ('venda_direta', 'captacao')),
  ordem       int         NOT NULL DEFAULT 0,
  ativo       boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Nome único case-insensitive (é o label exibido na barra de abas).
CREATE UNIQUE INDEX idx_dashboard_abas_nome_lower ON dashboard_abas (lower(nome));
CREATE INDEX        idx_dashboard_abas_ordem       ON dashboard_abas (ordem);

CREATE TABLE dashboard_aba_filtros (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  aba_id     uuid        NOT NULL REFERENCES dashboard_abas(id) ON DELETE CASCADE,
  papel      text        NOT NULL,  -- 'trafego' | 'vendas' | futuros ('leads_tag', 'sendflow', ...)
  -- NULLABLE de propósito: ON DELETE SET NULL preserva a aba se o filtro for
  -- apagado em "Filtros Personalizados" (vínculo vira órfão → "soma tudo no range").
  filtro_id  uuid        REFERENCES filtros_personalizados(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_aba_papel UNIQUE (aba_id, papel)  -- 1 filtro por papel por aba
);

CREATE INDEX idx_dashboard_aba_filtros_aba ON dashboard_aba_filtros(aba_id);

CREATE TRIGGER trg_dashboard_abas_updated_at
  BEFORE UPDATE ON dashboard_abas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE dashboard_abas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_aba_filtros ENABLE ROW LEVEL SECURITY;

-- RLS (mesmo padrão de filtros_personalizados):
-- SELECT liberado a qualquer autenticado; escrita só admin.

CREATE POLICY "dashboard_abas_select" ON dashboard_abas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "dashboard_aba_filtros_select" ON dashboard_aba_filtros
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "dashboard_abas_insert" ON dashboard_abas
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil = 'admin')
  );

CREATE POLICY "dashboard_abas_update" ON dashboard_abas
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil = 'admin')
  );

CREATE POLICY "dashboard_abas_delete" ON dashboard_abas
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil = 'admin')
  );

CREATE POLICY "dashboard_aba_filtros_insert" ON dashboard_aba_filtros
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil = 'admin')
  );

CREATE POLICY "dashboard_aba_filtros_update" ON dashboard_aba_filtros
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil = 'admin')
  );

CREATE POLICY "dashboard_aba_filtros_delete" ON dashboard_aba_filtros
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil = 'admin')
  );

-- ============================================================
-- SEED: migra a aba TPW (hoje hardcoded) para o modelo dinâmico.
-- Idempotente (não duplica se já existir uma aba 'TPW').
-- UUIDs reconfirmados ao vivo em 2026-05-31:
--   filtro trafego TPW = 614d701c-9c5b-446d-8d42-49c836e47a5b
--   filtro vendas  TPW = 223328fd-7bb8-4ae6-af1a-fbf27fe4116c
-- ============================================================

WITH nova AS (
  INSERT INTO dashboard_abas (nome, tipo_mockup, ordem, ativo)
  SELECT 'TPW', 'venda_direta', 1, true
  WHERE NOT EXISTS (SELECT 1 FROM dashboard_abas WHERE lower(nome) = lower('TPW'))
  RETURNING id
)
INSERT INTO dashboard_aba_filtros (aba_id, papel, filtro_id)
SELECT nova.id, v.papel, v.filtro_id::uuid
FROM nova, (VALUES
  ('trafego', '614d701c-9c5b-446d-8d42-49c836e47a5b'),
  ('vendas',  '223328fd-7bb8-4ae6-af1a-fbf27fe4116c')
) AS v(papel, filtro_id);
