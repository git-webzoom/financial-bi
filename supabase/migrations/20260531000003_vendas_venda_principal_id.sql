-- Agrupamento de order bumps/upsells da Manager Guru na venda principal.
-- A MG envia 1 webhook por transação; uma compra com bumps vira N linhas em vendas.
-- Esta coluna liga cada bump à sua transação mãe (payload.last_transaction.id).
-- NULL = é a própria venda mãe OU uma venda avulsa (bump órfão cuja mãe nunca chegou).

ALTER TABLE vendas ADD COLUMN IF NOT EXISTS venda_principal_id uuid;

COMMENT ON COLUMN vendas.venda_principal_id IS
  'ID da transação mãe quando esta venda é order bump/upsell (payload.last_transaction.id); NULL se é a própria mãe ou avulsa. Origem: Manager Guru.';

CREATE INDEX IF NOT EXISTS idx_vendas_venda_principal_id ON vendas(venda_principal_id);

-- Backfill histórico: para cada venda cujo payload é order bump (is_order_bump='1'),
-- copiar o id da mãe. Só vincula se a mãe existir em vendas (órfãos ficam NULL = avulsos).
-- Idempotente (re-rodável).
WITH bumps AS (
  SELECT v.id AS bump_id,
         (rv.payload->'last_transaction'->>'id')::uuid AS parent_id
  FROM vendas v
  JOIN raw_vendas rv ON rv.id = v.raw_id
  WHERE rv.payload->>'is_order_bump' = '1'
    AND NULLIF(rv.payload->'last_transaction'->>'id','') IS NOT NULL
)
UPDATE vendas v
SET venda_principal_id = b.parent_id
FROM bumps b
WHERE v.id = b.bump_id
  AND EXISTS (SELECT 1 FROM vendas m WHERE m.id = b.parent_id);
