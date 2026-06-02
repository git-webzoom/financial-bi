-- Lead Score WEBN — schema (Fase 1)
--
-- Implementa a TABELA DE PONTOS do Lead Score WEBN (aproximação interpretável da
-- regressão logística ROC-AUC 0.69). Ver docs/PLANO-LEAD-SCORE.md.
--
-- Tudo aditivo: 3 tabelas novas, nenhuma tabela/função/cron existente é tocada.
--   raw_lead_score    → corpo cru do webhook (auditoria/reprocesso)
--   lead_score_pontos → config da scorecard (editável p/ re-score sem mudar código)
--   lead_score        → 1 linha por contato (faixa A+/A/B/C/D + breakdown)

-- RAW (corpo cru do webhook)
CREATE TABLE raw_lead_score (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payload      jsonb,
  processed    boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  error        text,
  received_at  timestamptz NOT NULL DEFAULT now()
);

-- Tabela de pontos (config — editável p/ re-score sem mudar código)
CREATE TABLE lead_score_pontos (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variavel text NOT NULL,
  resposta text NOT NULL,      -- TEXTO EXATO do form
  pontos   int  NOT NULL,
  UNIQUE (variavel, resposta)
);

-- Score por contato (1 linha por lead)
CREATE TABLE lead_score (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contato_id   uuid NOT NULL REFERENCES contatos(id) ON DELETE CASCADE,
  email        text,
  respostas    jsonb,          -- todas as 14 respostas (inclui as não pontuadas)
  breakdown    jsonb,          -- pontos por variável
  pontos_total int  NOT NULL DEFAULT 0,
  faixa        text NOT NULL DEFAULT 'D',
  raw_id       uuid REFERENCES raw_lead_score(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contato_id)
);
CREATE INDEX idx_lead_score_contato_id ON lead_score(contato_id);
CREATE INDEX idx_lead_score_faixa      ON lead_score(faixa);
CREATE INDEX idx_lead_score_email      ON lead_score(email);

CREATE TRIGGER trg_lead_score_updated_at BEFORE UPDATE ON lead_score
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS (padrão do projeto: SELECT authenticated / escrita service_role)
ALTER TABLE raw_lead_score    ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_score        ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_score_pontos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "raw_lead_score_write_service"    ON raw_lead_score    FOR ALL    TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "lead_score_select"               ON lead_score        FOR SELECT TO authenticated USING (true);
CREATE POLICY "lead_score_write_service"        ON lead_score        FOR ALL    TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "lead_score_pontos_select"        ON lead_score_pontos FOR SELECT TO authenticated USING (true);
CREATE POLICY "lead_score_pontos_write_service" ON lead_score_pontos FOR ALL    TO service_role USING (true) WITH CHECK (true);
