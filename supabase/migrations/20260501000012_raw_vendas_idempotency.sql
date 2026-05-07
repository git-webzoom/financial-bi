-- A idempotency_key agora é id_transacao + status,
-- permitindo múltiplos eventos para a mesma transação (approved, refunded, etc.)
-- O UNIQUE em idempotency_key continua — cada combinação id+status é única.
-- Nenhuma alteração estrutural necessária além do novo deploy da Edge Function.

-- Garante que registros antigos com chave no formato antigo (id_transaction)
-- não conflitem com os novos (id_status). Apenas documentação.
COMMENT ON COLUMN raw_vendas.idempotency_key IS
  'Formato: {transaction_id}_{status} — garante que cada mudança de status seja processada uma única vez';
