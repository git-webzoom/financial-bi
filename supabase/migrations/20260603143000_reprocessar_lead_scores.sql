-- Lead Score WEBN — re-score em lote (RPC manual)
--
-- Problema que resolve: o score de cada lead é calculado UMA vez (no webhook-lead-score)
-- e fica congelado em lead_score. Se a scorecard (lead_score_pontos) for editada, os leads
-- ANTIGOS não recalculam sozinhos — só leads novos pontuam pela régua nova. Esta função
-- reprocessa a base inteira com os pontos ATUAIS, a partir das respostas já guardadas em
-- lead_score.respostas (não precisa reenviar formulário).
--
-- Disparo: MANUAL, sob demanda (sem cron, sem trigger). Ex.: SELECT reprocessar_lead_scores();
-- Escopo: só recalcular (sobrescreve pontos_total/faixa/breakdown). Sem histórico.
-- Idempotente: rodar sem editar a scorecard não altera nada (recálculo == gravado).
-- Reaproveita calcular_lead_score() — NÃO duplica a lógica de pontuação.
--
-- ATENÇÃO (acoplamento): lead_score.respostas guarda os NOMES DE CAMPO DO FORMULÁRIO
-- (profissional, tempo_tasso, valor_investido...), enquanto calcular_lead_score espera as
-- VARIÁVEIS da scorecard (profissao, conhece, valor...). Por isso renormalizamos abaixo com
-- o MESMO mapeamento da Edge Function supabase/functions/webhook-lead-score/index.ts (MAP).
-- Se aquele MAP mudar, este precisa mudar junto. Os 4 campos genero/capital/sonho/
-- diferencial_tasso não pontuam e ficam de fora (idêntico ao index.ts).

CREATE OR REPLACE FUNCTION reprocessar_lead_scores()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total          int := 0;
  v_pontos_mudaram int := 0;
  v_faixas_mudaram int := 0;
  r                record;
  v_resp_norm      jsonb;
  v_score          jsonb;
  v_novo_total     int;
  v_nova_faixa     text;
  v_novo_break     jsonb;
BEGIN
  -- MAP form-field → variável da scorecard (espelha o webhook-lead-score/index.ts)
  FOR r IN
    SELECT
      ls.id,
      ls.pontos_total AS pontos_atual,
      ls.faixa        AS faixa_atual,
      (
        SELECT jsonb_object_agg(m.variavel, ls.respostas ->> m.campo)
        FROM (VALUES
          ('idade',              'idade'),
          ('escolaridade',       'escolaridade'),
          ('profissional',       'profissao'),
          ('renda',              'renda'),
          ('investe_cripto',     'cripto'),
          ('valor_investido',    'valor'),
          ('disponivel_mes',     'disponivel_mes'),
          ('tempo_tasso',        'conhece'),
          ('objetivo_cripto',    'objetivo'),
          ('dificuldade_cripto', 'dificuldade')
        ) AS m(campo, variavel)
        WHERE ls.respostas ? m.campo
      ) AS resp_norm
    FROM lead_score ls
  LOOP
    v_total := v_total + 1;

    v_resp_norm := COALESCE(r.resp_norm, '{}'::jsonb);
    v_score     := calcular_lead_score(v_resp_norm);
    v_novo_total := (v_score ->> 'pontos_total')::int;
    v_nova_faixa := v_score ->> 'faixa';
    v_novo_break := v_score -> 'breakdown';

    -- grava só quando mudou (evita disparar trg_lead_score_updated_at à toa)
    IF v_novo_total IS DISTINCT FROM r.pontos_atual
       OR v_nova_faixa IS DISTINCT FROM r.faixa_atual THEN
      UPDATE lead_score
        SET pontos_total = v_novo_total,
            faixa        = v_nova_faixa,
            breakdown    = v_novo_break,
            updated_at   = now()
        WHERE id = r.id;

      IF v_novo_total IS DISTINCT FROM r.pontos_atual THEN
        v_pontos_mudaram := v_pontos_mudaram + 1;
      END IF;
      IF v_nova_faixa IS DISTINCT FROM r.faixa_atual THEN
        v_faixas_mudaram := v_faixas_mudaram + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'total_processados', v_total,
    'pontos_mudaram',    v_pontos_mudaram,
    'faixas_mudaram',    v_faixas_mudaram
  );
END;
$$;
