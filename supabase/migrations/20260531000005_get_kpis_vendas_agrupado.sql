-- get_kpis_vendas: agrupa order bumps/upsells na venda mãe.
--  - totalVendas conta 1 por GRUPO cuja MÃE é aprovada (bumps não contam separado).
--  - faturamento soma cada linha aprovada do grupo (mãe + bumps), respeitando status por linha.
--  - período/produto/marketplace ancorados na MÃE; bumps entram pelo vínculo venda_principal_id.
CREATE OR REPLACE FUNCTION public.get_kpis_vendas(
  p_inicio timestamptz,
  p_fim timestamptz,
  p_produto_id uuid DEFAULT NULL,
  p_marketplace text DEFAULT NULL
)
 RETURNS json
 LANGUAGE sql
 STABLE
AS $function$
  WITH maes AS (
    SELECT id, status
    FROM vendas
    WHERE venda_principal_id IS NULL
      AND data_pedido >= p_inicio
      AND data_pedido <= p_fim
      AND (p_produto_id  IS NULL OR produto_id  = p_produto_id)
      AND (p_marketplace IS NULL OR marketplace = p_marketplace)
  ),
  grupo AS (
    SELECT v.status, v.valor_venda, v.valor_liquido
    FROM vendas v
    WHERE v.id IN (SELECT id FROM maes)
       OR v.venda_principal_id IN (SELECT id FROM maes)
  )
  SELECT json_build_object(
    'faturamentoBruto',   COALESCE(SUM(CASE WHEN is_venda_aprovada(g.status) THEN g.valor_venda   ELSE 0 END), 0),
    'faturamentoLiquido', COALESCE(SUM(CASE WHEN is_venda_aprovada(g.status) THEN g.valor_liquido ELSE 0 END), 0),
    'totalVendas',        (SELECT COUNT(*) FROM maes WHERE is_venda_aprovada(status)),
    'reembolsos',         COUNT(*) FILTER (WHERE g.status IN ('refunded', 'refunded_sol')),
    'chargebacks',        COUNT(*) FILTER (WHERE g.status = 'chargeback')
  )
  FROM grupo g;
$function$;
