-- Remove FKs de vendas para ofertas e produtos
-- Os IDs são mantidos como referência informativa mas sem constraint,
-- pois nem sempre os cadastros existem antes das vendas chegarem via webhook.

ALTER TABLE vendas DROP CONSTRAINT IF EXISTS vendas_oferta_id_fkey;
ALTER TABLE vendas DROP CONSTRAINT IF EXISTS vendas_produto_id_fkey;
