-- Configuração de dia/hora de início e fim de semana por entidade

-- ─── Tabela ──────────────────────────────────────────────────────────────────

CREATE TABLE semana_config (
  entidade    text        PRIMARY KEY,
  dia_inicio  int         NOT NULL DEFAULT 3,          -- 0=Dom … 6=Sáb  (3=Qua)
  hora_inicio time        NOT NULL DEFAULT '00:00:00', -- em BRT
  dia_fim     int         NOT NULL DEFAULT 2,          -- 0=Dom … 6=Sáb  (2=Ter)
  hora_fim    time        NOT NULL DEFAULT '20:00:00', -- em BRT
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_dia_inicio CHECK (dia_inicio BETWEEN 0 AND 6),
  CONSTRAINT chk_dia_fim    CHECK (dia_fim    BETWEEN 0 AND 6)
);

-- Defaults espelham o comportamento atual: quarta 00:00 → terça 20:00 BRT
INSERT INTO semana_config (entidade, dia_inicio, hora_inicio, dia_fim, hora_fim) VALUES
  ('crm',      3, '00:00:00', 2, '20:00:00'),
  ('webinario', 3, '00:00:00', 2, '20:00:00'),
  ('grupos',   3, '00:00:00', 2, '20:00:00'),
  ('vendas',   3, '00:00:00', 2, '20:00:00'),
  ('trafego',  3, '00:00:00', 2, '20:00:00');

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE semana_config ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode ler
CREATE POLICY "select_autenticado" ON semana_config
  FOR SELECT TO authenticated USING (true);

-- Apenas admin pode escrever
CREATE POLICY "write_admin" ON semana_config
  FOR ALL TO authenticated
  USING (get_user_perfil() = 'admin')
  WITH CHECK (get_user_perfil() = 'admin');

-- ─── Função auxiliar: próxima ocorrência de (dia_semana, hora) após um instante ─

-- Retorna o instante UTC mais próximo que seja >= ref e que caia no
-- dia-da-semana e hora BRT especificados.
CREATE OR REPLACE FUNCTION proxima_ocorrencia_brt(
  ref       timestamptz,
  p_dia     int,   -- 0=Dom … 6=Sáb  (EXTRACT DOW, estilo PostgreSQL)
  p_hora    time   -- hora em BRT (America/Sao_Paulo)
)
RETURNS timestamptz
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  ref_brt   timestamp;   -- ref convertido para BRT (sem fuso)
  base_date date;
  candidato timestamptz;
  delta     int;
BEGIN
  ref_brt   := ref AT TIME ZONE 'America/Sao_Paulo';
  base_date := ref_brt::date;

  -- Diferença em dias até o próximo dia-da-semana desejado
  delta := (p_dia - EXTRACT(DOW FROM base_date)::int + 7) % 7;

  -- Monta candidato neste mesmo dia
  candidato := (base_date + delta * INTERVAL '1 day' + p_hora)
               AT TIME ZONE 'America/Sao_Paulo';

  -- Se o candidato ficou no passado ou exatamente igual, avança 7 dias
  IF candidato <= ref THEN
    candidato := candidato + INTERVAL '7 days';
  END IF;

  RETURN candidato;
END;
$$;

-- ─── Recria ensure_semana_existe lendo semana_config ─────────────────────────

CREATE OR REPLACE FUNCTION ensure_semana_existe(p_numero int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config   semana_config%ROWTYPE;
  v_anterior webinario_semanas%ROWTYPE;
  v_inicio   timestamptz;
  v_evento   timestamptz;
BEGIN
  -- Idempotente: não faz nada se já existe
  IF EXISTS (SELECT 1 FROM webinario_semanas WHERE numero = p_numero) THEN
    RETURN;
  END IF;

  SELECT * INTO v_config   FROM semana_config    WHERE entidade = 'crm';
  SELECT * INTO v_anterior FROM webinario_semanas WHERE numero  = p_numero - 1;

  -- Sem semana anterior não há como calcular datas
  IF v_anterior IS NULL THEN
    RETURN;
  END IF;

  -- data_inicio: próxima ocorrência de (dia_inicio, hora_inicio) após data_evento anterior
  v_inicio := proxima_ocorrencia_brt(
    v_anterior.data_evento,
    v_config.dia_inicio,
    v_config.hora_inicio
  );

  -- data_evento: próxima ocorrência de (dia_fim, hora_fim) após data_inicio
  v_evento := proxima_ocorrencia_brt(
    v_inicio,
    v_config.dia_fim,
    v_config.hora_fim
  );

  INSERT INTO webinario_semanas (numero, data_inicio, data_evento, data_fim)
  VALUES (p_numero, v_inicio, v_evento, v_evento)
  ON CONFLICT (numero) DO NOTHING;
END;
$$;
