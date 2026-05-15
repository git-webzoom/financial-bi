-- ============================================================
-- FILTROS PERSONALIZADOS
-- ============================================================

CREATE TABLE filtros_personalizados (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text        NOT NULL,
  modulo     text        NOT NULL CHECK (modulo IN ('trafego', 'vendas')),
  ativo      boolean     NOT NULL DEFAULT true,
  criado_por uuid        REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE filtros_personalizados_regras (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  filtro_id  uuid        NOT NULL REFERENCES filtros_personalizados(id) ON DELETE CASCADE,
  campo      text        NOT NULL,
  operador   text        NOT NULL CHECK (operador IN ('contem', 'nao_contem', 'igual', 'comeca_com')),
  valor      text        NOT NULL,
  ordem      int         NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_filtros_modulo    ON filtros_personalizados(modulo);
CREATE INDEX idx_regras_filtro_id  ON filtros_personalizados_regras(filtro_id);

CREATE TRIGGER trg_filtros_updated_at
  BEFORE UPDATE ON filtros_personalizados
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE filtros_personalizados        ENABLE ROW LEVEL SECURITY;
ALTER TABLE filtros_personalizados_regras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "filtros_select" ON filtros_personalizados
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "regras_select" ON filtros_personalizados_regras
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "filtros_insert" ON filtros_personalizados
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil = 'admin')
  );

CREATE POLICY "filtros_update" ON filtros_personalizados
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil = 'admin')
  );

CREATE POLICY "filtros_delete" ON filtros_personalizados
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil = 'admin')
  );

CREATE POLICY "regras_insert" ON filtros_personalizados_regras
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil = 'admin')
  );

CREATE POLICY "regras_update" ON filtros_personalizados_regras
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil = 'admin')
  );

CREATE POLICY "regras_delete" ON filtros_personalizados_regras
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil = 'admin')
  );
