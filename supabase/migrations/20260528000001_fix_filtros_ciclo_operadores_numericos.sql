-- 1. Expande constraint de operadores para incluir maior_que e menor_que
ALTER TABLE filtros_personalizados_regras
  DROP CONSTRAINT IF EXISTS filtros_personalizados_regras_operador_check;

ALTER TABLE filtros_personalizados_regras
  ADD CONSTRAINT filtros_personalizados_regras_operador_check
  CHECK (operador IN ('contem', 'nao_contem', 'igual', 'comeca_com', 'maior_que', 'menor_que'));

-- 2. Converte assinatura_ciclo de text para integer
ALTER TABLE vendas
  ALTER COLUMN assinatura_ciclo TYPE integer
  USING NULLIF(assinatura_ciclo, '')::integer;
