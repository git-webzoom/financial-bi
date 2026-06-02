-- ============================================================================
-- ensure_semana_webnario_existe vira no-op — para o cron de gerar linhas físicas
-- ============================================================================
-- A tabela webinario_semanas_presencas não é mais fonte de verdade do webinário:
-- get_semana_webnario_ativa (migration 20260602000006) e get_periodo_semana(_,'webn')
-- (migration 20260602000008) agora CALCULAM a semana/período pela régua 'webn'.
-- Esta função criava linhas com datas erradas (config 'webn' terça 20:00 vs evento real
-- 19:30), encurtando a semana ativa para minutos — raiz do bug de 2026-06-02.
-- Mantida (não dropada) por ser chamada pelo cron auto_criar_proxima_semana; agora no-op.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ensure_semana_webnario_existe(p_numero integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- no-op intencional: a semana de webinário é calculada, não materializada.
  RETURN;
END;
$function$;
