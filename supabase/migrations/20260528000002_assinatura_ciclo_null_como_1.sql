-- Trata assinatura_ciclo NULL como 1 (primeira compra sem ciclo informado = ciclo 1)
-- Assim o filtro "menor ou igual a 1" captura todos os registros sem ciclo informado
UPDATE vendas SET assinatura_ciclo = 1 WHERE assinatura_ciclo IS NULL;

-- Define default 1 para novos registros sem ciclo
ALTER TABLE vendas ALTER COLUMN assinatura_ciclo SET DEFAULT 1;
