-- Revertido: vendas avulsas permanecem NULL, o filtro trata NULL como <= valor
-- Este arquivo documenta a decisão: NULL em assinatura_ciclo significa venda sem ciclo informado
-- O filtro "menor_igual" no frontend usa OR IS NULL para incluir esses registros

-- Reverte qualquer ciclo=1 que tenha sido setado em vendas avulsas sem subscription
UPDATE vendas v
SET assinatura_ciclo = NULL
FROM raw_vendas rv
WHERE rv.id = v.raw_id
  AND v.assinatura_ciclo = 1
  AND rv.payload->'subscription'->>'id' IS NULL
  AND rv.payload->'invoice'->>'cycle' IS NULL
  AND rv.payload->'subscription'->>'charged_times' IS NULL;
