-- Lead Score WEBN — RPC de cálculo (Fase 3)
--
-- Recebe as respostas JÁ normalizadas (chave = `variavel` da scorecard, produzida
-- pelo MAP da Edge Function webhook-lead-score) e devolve:
--   pontos_total : soma dos pontos
--   faixa        : A+/A/B/C/D  (A+>=104, A>=90, B>=75, C>=53, D<53)
--   breakdown    : pontos por variável (jsonb)
-- Resposta ausente OU não listada em lead_score_pontos = 0 pontos.

CREATE OR REPLACE FUNCTION calcular_lead_score(p_respostas jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key   text;
  v_resp  text;
  v_pts   int;
  v_total int   := 0;
  v_break jsonb := '{}'::jsonb;
  v_faixa text;
BEGIN
  FOR v_key, v_resp IN SELECT key, value FROM jsonb_each_text(p_respostas) LOOP
    SELECT pontos INTO v_pts
      FROM lead_score_pontos
      WHERE variavel = v_key AND resposta = v_resp
      LIMIT 1;
    v_pts   := COALESCE(v_pts, 0);
    v_total := v_total + v_pts;
    v_break := v_break || jsonb_build_object(v_key, v_pts);
  END LOOP;

  v_faixa := CASE
    WHEN v_total >= 104 THEN 'A+'
    WHEN v_total >= 90  THEN 'A'
    WHEN v_total >= 75  THEN 'B'
    WHEN v_total >= 53  THEN 'C'
    ELSE 'D'
  END;

  RETURN jsonb_build_object(
    'pontos_total', v_total,
    'faixa',        v_faixa,
    'breakdown',    v_break
  );
END;
$$;
