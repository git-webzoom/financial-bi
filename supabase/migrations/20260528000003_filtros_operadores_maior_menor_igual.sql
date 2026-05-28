-- Adiciona operadores maior_igual e menor_igual na constraint
ALTER TABLE filtros_personalizados_regras
  DROP CONSTRAINT IF EXISTS filtros_personalizados_regras_operador_check;

ALTER TABLE filtros_personalizados_regras
  ADD CONSTRAINT filtros_personalizados_regras_operador_check
  CHECK (operador IN ('contem', 'nao_contem', 'igual', 'comeca_com', 'maior_que', 'menor_que', 'maior_igual', 'menor_igual'));
