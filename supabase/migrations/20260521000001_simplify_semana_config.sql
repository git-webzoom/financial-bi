-- Simplifica semana_config: 5 entidades → 2 configs (captacao, webn)
--
-- Antes: crm, webinario, grupos, vendas, trafego (valores divergentes)
-- Depois: captacao (CRM + Grupos + Tráfego) e webn (Vendas + Webinário)
-- Ambos com Terça 20:00 → Terça 19:59 BRT

-- ─── 1. Substitui as linhas ───────────────────────────────────────────────────

DELETE FROM semana_config
WHERE entidade IN ('crm', 'webinario', 'grupos', 'vendas', 'trafego');

INSERT INTO semana_config (entidade, dia_inicio, hora_inicio, dia_fim, hora_fim) VALUES
  ('captacao', 2, '20:00:00', 2, '19:59:00'),
  ('webn',     2, '20:00:00', 2, '19:59:00');

-- ─── 2. ensure_semana_existe: usa 'captacao' em vez de 'crm' ─────────────────

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
  IF EXISTS (SELECT 1 FROM webinario_semanas WHERE numero = p_numero) THEN
    RETURN;
  END IF;

  SELECT * INTO v_config   FROM semana_config    WHERE entidade = 'captacao';
  SELECT * INTO v_anterior FROM webinario_semanas WHERE numero  = p_numero - 1;

  IF v_anterior IS NULL THEN
    RETURN;
  END IF;

  v_inicio := proxima_ocorrencia_brt(
    v_anterior.data_evento,
    v_config.dia_inicio,
    v_config.hora_inicio
  );

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

-- ─── 3. listar_semanas_recentes: usa 'captacao' em vez de 'trafego' ──────────

-- Remove a versão antiga (1 param) que lê direto de webinario_semanas
DROP FUNCTION IF EXISTS listar_semanas_recentes(integer);

CREATE OR REPLACE FUNCTION listar_semanas_recentes(
  p_limit  integer DEFAULT 4,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(numero integer, inicio date, fim date)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_dia_ini   int;
  v_hora_ini  time;
  v_dia_fim   int;
  v_num_max   int;
  v_ref_ini   date;
  v_num_atual int;
  v_ini_atual date;
  v_delta_fim int;
BEGIN
  SELECT dia_inicio, hora_inicio, dia_fim INTO v_dia_ini, v_hora_ini, v_dia_fim
  FROM semana_config WHERE entidade = 'captacao';

  SELECT ws.numero, DATE(ws.data_inicio AT TIME ZONE 'America/Sao_Paulo')
  INTO v_num_max, v_ref_ini
  FROM webinario_semanas ws ORDER BY ws.numero DESC LIMIT 1;

  v_ini_atual := ultima_ocorrencia_brt(v_dia_ini, v_hora_ini);
  v_num_atual := v_num_max + ((v_ini_atual - v_ref_ini) / 7);

  v_delta_fim := (v_dia_fim - v_dia_ini + 7) % 7;
  IF v_delta_fim = 0 THEN v_delta_fim := 7; END IF;

  RETURN QUERY
  SELECT
    (v_num_atual - p_offset - gs.n)::int                         AS numero,
    (v_ini_atual - ((p_offset + gs.n) * 7))::date                AS inicio,
    (v_ini_atual - ((p_offset + gs.n) * 7) + v_delta_fim)::date  AS fim
  FROM generate_series(0, p_limit - 1) AS gs(n)
  ORDER BY numero DESC;
END;
$$;

-- ─── 4. listar_semanas_vendas: usa 'webn' em vez de 'vendas' ─────────────────

CREATE OR REPLACE FUNCTION listar_semanas_vendas(
  p_limit integer DEFAULT 4
)
RETURNS TABLE(numero integer, inicio date, fim date)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_dia_ini   int;
  v_hora_ini  time;
  v_dia_fim   int;
  v_num_max   int;
  v_ref_ini   date;
  v_num_atual int;
  v_ini_atual date;
  v_delta_fim int;
BEGIN
  SELECT dia_inicio, hora_inicio, dia_fim INTO v_dia_ini, v_hora_ini, v_dia_fim
  FROM semana_config WHERE entidade = 'webn';

  SELECT ws.numero, DATE(ws.data_inicio AT TIME ZONE 'America/Sao_Paulo')
  INTO v_num_max, v_ref_ini
  FROM webinario_semanas ws ORDER BY ws.numero DESC LIMIT 1;

  v_ini_atual := ultima_ocorrencia_brt(v_dia_ini, v_hora_ini);
  v_num_atual := (v_num_max + ((v_ini_atual - v_ref_ini) / 7)) - 1;

  v_delta_fim := (v_dia_fim - v_dia_ini + 7) % 7;
  IF v_delta_fim = 0 THEN v_delta_fim := 7; END IF;

  RETURN QUERY
  SELECT
    (v_num_atual - gs.n)::int                                    AS numero,
    (v_ini_atual - (gs.n * 7))::date                             AS inicio,
    (v_ini_atual - (gs.n * 7) + v_delta_fim)::date               AS fim
  FROM generate_series(0, p_limit - 1) AS gs(n)
  ORDER BY numero DESC;
END;
$$;
