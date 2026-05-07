-- ============================================================
-- Função process_venda(raw_id uuid)
-- Chamada pela Edge Function após gravar em raw_vendas.
-- ============================================================

CREATE OR REPLACE FUNCTION process_venda(raw_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_payload     jsonb;
  v_contato_id  uuid;
  v_telefone    text;
  v_rppc        text;
  v_produto_id  uuid;
  v_oferta_id   uuid;
BEGIN
  -- Carregar payload
  SELECT payload INTO v_payload FROM raw_vendas WHERE id = raw_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'raw_vendas não encontrado: %', raw_id;
  END IF;

  -- Montar telefone
  v_telefone := NULLIF(
    TRIM(COALESCE(v_payload->'contact'->>'phone_local_code','') ||
         COALESCE(v_payload->'contact'->>'phone_number','')),
    ''
  );

  -- PASSO 1: upsert_contato
  v_contato_id := upsert_contato(
    p_email                 := lower(trim(v_payload->'contact'->>'email')),
    p_nome                  := v_payload->'contact'->>'name',
    p_telefone              := v_telefone,
    p_doc                   := v_payload->'contact'->>'doc',
    p_estado                := v_payload->'contact'->>'address_state',
    p_pais                  := v_payload->'contact'->>'address_country',
    p_ac_contact_id         := NULL,
    p_primeira_captura      := v_payload->'contact'->'lead'->'first_tracking'->>'name',
    p_data_primeira_captura := (v_payload->'contact'->'lead'->'first_tracking'->>'tracked_at')::timestamptz,
    p_ultima_captura        := v_payload->'contact'->'lead'->'last_tracking'->>'name',
    p_data_ultima_captura   := (v_payload->'contact'->'lead'->'last_tracking'->>'tracked_at')::timestamptz
  );

  -- IDs do produto e oferta
  -- ATENÇÃO: product.internal_id é o UUID real; product.id é o marketplace_id numérico
  v_produto_id := (v_payload->'product'->>'internal_id')::uuid;
  v_oferta_id  := (v_payload->'product'->'offer'->>'id')::uuid;

  -- rppc: primeiro elemento do array pptc, ou null
  v_rppc := CASE
    WHEN jsonb_array_length(COALESCE(v_payload->'source'->'pptc','[]'::jsonb)) > 0
    THEN v_payload->'source'->'pptc'->0->>0
    ELSE NULL
  END;

  -- PASSO 2: upsert na tabela vendas
  INSERT INTO vendas (
    id, contato_id, produto_id, oferta_id,
    marketplace, marketplace_id,
    status, pagamento, parcelas, moeda,
    valor_venda, valor_liquido, valor_marketplace, valor_afiliado,
    valor_desconto, valor_parcela,
    nome_contato, email_contato, doc_contato, telefone_contato,
    estado_contato, pais_contato,
    utm_source, utm_campaign, utm_medium, utm_content,
    rppc_checkout, nome_oferta, url_oferta,
    motivo_reembolso, assinatura_ciclo,
    data_pedido, data_aprovacao, data_cancelamento, data_garantia,
    raw_id
  ) VALUES (
    (v_payload->>'id')::uuid,
    v_contato_id,
    v_produto_id,
    v_oferta_id,
    v_payload->'items'->0->>'marketplace_name',
    v_payload->'items'->0->>'marketplace_id',
    v_payload->>'status',
    v_payload->'payment'->>'method',
    (v_payload->'payment'->'installments'->>'qty')::int,
    v_payload->'payment'->>'currency',
    (v_payload->'payment'->>'total')::numeric,
    (v_payload->'payment'->>'net')::numeric,
    (v_payload->'payment'->>'marketplace_value')::numeric,
    (v_payload->'payment'->>'affiliate_value')::numeric,
    (v_payload->'payment'->>'discount_value')::numeric,
    (v_payload->'payment'->'installments'->>'value')::numeric,
    v_payload->'contact'->>'name',
    lower(trim(v_payload->'contact'->>'email')),
    v_payload->'contact'->>'doc',
    v_telefone,
    v_payload->'contact'->>'address_state',
    v_payload->'contact'->>'address_country',
    v_payload->'source'->>'utm_source',
    v_payload->'source'->>'utm_campaign',
    v_payload->'source'->>'utm_medium',
    v_payload->'source'->>'utm_content',
    v_rppc,
    v_payload->'product'->'offer'->>'name',
    v_payload->>'checkout_url',
    v_payload->'payment'->>'refund_reason',
    NULL,
    (v_payload->'dates'->>'ordered_at')::timestamptz,
    (v_payload->'dates'->>'confirmed_at')::timestamptz,
    (v_payload->'dates'->>'canceled_at')::timestamptz,
    (v_payload->'dates'->>'warranty_until')::timestamptz,
    raw_id
  )
  ON CONFLICT (id) DO UPDATE SET
    contato_id        = EXCLUDED.contato_id,
    status            = EXCLUDED.status,
    pagamento         = EXCLUDED.pagamento,
    parcelas          = EXCLUDED.parcelas,
    valor_venda       = EXCLUDED.valor_venda,
    valor_liquido     = EXCLUDED.valor_liquido,
    valor_marketplace = EXCLUDED.valor_marketplace,
    valor_afiliado    = EXCLUDED.valor_afiliado,
    valor_desconto    = EXCLUDED.valor_desconto,
    valor_parcela     = EXCLUDED.valor_parcela,
    motivo_reembolso  = EXCLUDED.motivo_reembolso,
    data_aprovacao    = EXCLUDED.data_aprovacao,
    data_cancelamento = EXCLUDED.data_cancelamento,
    data_garantia     = EXCLUDED.data_garantia,
    raw_id            = EXCLUDED.raw_id,
    updated_at        = now();

  -- PASSO 3: marcar raw como processado
  UPDATE raw_vendas
  SET processed = true, processed_at = now()
  WHERE id = raw_id;

EXCEPTION WHEN OTHERS THEN
  -- Gravar erro sem re-lançar (Edge Function já retornou 200)
  UPDATE raw_vendas
  SET error = SQLERRM
  WHERE id = raw_id;
END;
$$;
