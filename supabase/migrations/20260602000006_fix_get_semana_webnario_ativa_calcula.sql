-- ============================================================================
-- FIX: get_semana_webnario_ativa() — calcular igual Vendas, não ler linha física
-- ============================================================================
-- BUG (2026-06-02): o webinário mostrava a semana 176 quando o webinário real
-- era a 175, e leads/presenças caíam na 176 errada.
--
-- Causa raiz: get_semana_webnario_ativa lia a linha FÍSICA de
-- webinario_semanas_presencas (data_inicio <= now() < data_fim). Essa linha era
-- criada cedo demais por ensure_semana_webnario_existe (cron auto_criar_proxima_semana,
-- a cada 5 min): a config 'webn' tem hora_inicio = terça 20:00, mas o evento real da
-- 175 foi terça 19:30; "próxima terça 20:00" caiu no MESMO dia 30 min depois, criando
-- a 176 e encurtando a 175 para 30 minutos.
--
-- Correção: Webinário e Vendas são a MESMA entidade ('webn') e devem dar SEMPRE o
-- mesmo número. Vendas (listar_semanas_vendas) calcula via
-- ultima_ocorrencia_brt(config 'webn') ancorado em webinario_semanas, com -1 proposital.
-- Agora get_semana_webnario_ativa usa exatamente a mesma fórmula, eliminando a
-- dependência da linha física frágil.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_semana_webnario_ativa()
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
  v_dia_ini   int;
  v_hora_ini  time;
  v_num_max   int;
  v_ref_ini   date;
  v_ini_atual date;
BEGIN
  -- Régua do webinário/vendas (entidade 'webn')
  SELECT dia_inicio, hora_inicio
    INTO v_dia_ini, v_hora_ini
  FROM semana_config WHERE entidade = 'webn';

  -- Referência base: maior semana já criada em webinario_semanas (régua de captação)
  SELECT ws.numero, DATE(ws.data_inicio AT TIME ZONE 'America/Sao_Paulo')
    INTO v_num_max, v_ref_ini
  FROM webinario_semanas ws ORDER BY ws.numero DESC LIMIT 1;

  IF v_num_max IS NULL THEN
    RETURN NULL;
  END IF;

  v_ini_atual := ultima_ocorrencia_brt(v_dia_ini, v_hora_ini);

  -- "- 1" PROPOSITAL: Vendas/Webinário ficam uma semana atrás de Captação em número.
  -- (Mesma fórmula de listar_semanas_vendas — mantém Webinário e Vendas sincronizados.)
  RETURN (v_num_max + ((v_ini_atual - v_ref_ini) / 7)) - 1;
END;
$function$;
