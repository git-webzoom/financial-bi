-- process_venda: passa a preencher venda_principal_id ao ingerir webhooks da Manager Guru.
-- Se a transação é order bump (is_order_bump='1'), aponta para a transação mãe (last_transaction.id).
-- Cópia pura do id: funciona mesmo se o bump chegar ANTES da mãe (sem reconciliação).
CREATE OR REPLACE FUNCTION public.process_venda(raw_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_payload             jsonb;
  v_contato_id          uuid;
  v_telefone            text;
  v_rppc                text;
  v_produto_id          uuid;
  v_oferta_id           uuid;
  v_pptc                jsonb;
  v_ciclo               int;
  v_venda_principal_id  uuid;
BEGIN
  SELECT payload INTO v_payload FROM raw_vendas WHERE id = raw_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'raw_vendas não encontrado: %', raw_id;
  END IF;

  v_telefone := NULLIF(
    TRIM(COALESCE(v_payload->'contact'->>'phone_local_code','') ||
         COALESCE(v_payload->'contact'->>'phone_number','')),
    ''
  );

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

  v_produto_id := NULLIF(trim(v_payload->'product'->>'internal_id'), '')::uuid;
  v_oferta_id  := NULLIF(trim(v_payload->'product'->'offer'->>'id'), '')::uuid;

  v_pptc := v_payload->'source'->'pptc';
  v_rppc := CASE
    WHEN v_pptc IS NULL                        THEN NULL
    WHEN jsonb_typeof(v_pptc) = 'array'
     AND jsonb_array_length(v_pptc) > 0
      THEN CASE
             WHEN jsonb_typeof(v_pptc->0) = 'string' THEN v_pptc->>0
             ELSE v_pptc->0->>0
           END
    WHEN jsonb_typeof(v_pptc) = 'string'       THEN v_pptc#>>'{}'
    ELSE NULL
  END;

  -- Ciclo: invoice.cycle > subscription.charged_times > 1 se sem subscription (venda avulsa) > NULL
  v_ciclo := NULLIF(v_payload->'invoice'->>'cycle', '')::int;
  IF v_ciclo IS NULL THEN
    v_ciclo := NULLIF(v_payload->'subscription'->>'charged_times', '')::int;
  END IF;
  IF v_ciclo IS NULL AND v_payload->'subscription'->>'id' IS NULL THEN
    v_ciclo := 1;
  END IF;

  -- Agrupamento de order bump/upsell: se esta transação é um bump, aponta para a transação mãe.
  -- Cópia pura do id (não exige que a mãe já exista — o bump pode chegar antes dela).
  v_venda_principal_id := CASE
    WHEN v_payload->>'is_order_bump' = '1'
      THEN NULLIF(v_payload->'last_transaction'->>'id','')::uuid
    ELSE NULL
  END;

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
    raw_id, venda_principal_id
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
    NULLIF(v_payload->'payment'->>'total',            '')::numeric,
    NULLIF(v_payload->'payment'->>'net',              '')::numeric,
    NULLIF(v_payload->'payment'->>'marketplace_value','')::numeric,
    NULLIF(v_payload->'payment'->>'affiliate_value',  '')::numeric,
    NULLIF(v_payload->'payment'->>'discount_value',   '')::numeric,
    NULLIF(v_payload->'payment'->'installments'->>'value','')::numeric,
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
    v_ciclo,
    (v_payload->'dates'->>'ordered_at')::timestamptz,
    (v_payload->'dates'->>'confirmed_at')::timestamptz,
    (v_payload->'dates'->>'canceled_at')::timestamptz,
    (v_payload->'dates'->>'warranty_until')::timestamptz,
    raw_id,
    v_venda_principal_id
  )
  ON CONFLICT (id) DO UPDATE SET
    raw_id     = EXCLUDED.raw_id,
    updated_at = now(),
    status            = EXCLUDED.status,
    assinatura_ciclo  = COALESCE(EXCLUDED.assinatura_ciclo, vendas.assinatura_ciclo),
    motivo_reembolso  = COALESCE(NULLIF(EXCLUDED.motivo_reembolso,  ''), vendas.motivo_reembolso),
    data_cancelamento = COALESCE(EXCLUDED.data_cancelamento, vendas.data_cancelamento),
    data_garantia     = COALESCE(EXCLUDED.data_garantia,     vendas.data_garantia),
    data_aprovacao    = COALESCE(EXCLUDED.data_aprovacao,    vendas.data_aprovacao),
    data_pedido       = COALESCE(EXCLUDED.data_pedido,       vendas.data_pedido),
    valor_venda       = CASE WHEN COALESCE(EXCLUDED.valor_venda,       0) > 0 THEN EXCLUDED.valor_venda       ELSE vendas.valor_venda       END,
    valor_liquido     = CASE WHEN COALESCE(EXCLUDED.valor_liquido,     0) > 0 THEN EXCLUDED.valor_liquido     ELSE vendas.valor_liquido     END,
    valor_marketplace = CASE WHEN COALESCE(EXCLUDED.valor_marketplace, 0) > 0 THEN EXCLUDED.valor_marketplace ELSE vendas.valor_marketplace END,
    valor_afiliado    = CASE WHEN COALESCE(EXCLUDED.valor_afiliado,    0) > 0 THEN EXCLUDED.valor_afiliado    ELSE vendas.valor_afiliado    END,
    valor_desconto    = CASE WHEN COALESCE(EXCLUDED.valor_desconto,    0) > 0 THEN EXCLUDED.valor_desconto    ELSE vendas.valor_desconto    END,
    valor_parcela     = CASE WHEN COALESCE(EXCLUDED.valor_parcela,     0) > 0 THEN EXCLUDED.valor_parcela     ELSE vendas.valor_parcela     END,
    parcelas          = COALESCE(EXCLUDED.parcelas,          vendas.parcelas),
    contato_id        = COALESCE(EXCLUDED.contato_id,        vendas.contato_id),
    produto_id        = COALESCE(EXCLUDED.produto_id,        vendas.produto_id),
    oferta_id         = COALESCE(EXCLUDED.oferta_id,         vendas.oferta_id),
    venda_principal_id = COALESCE(EXCLUDED.venda_principal_id, vendas.venda_principal_id),
    marketplace       = COALESCE(NULLIF(EXCLUDED.marketplace,     ''), vendas.marketplace),
    marketplace_id    = COALESCE(NULLIF(EXCLUDED.marketplace_id,  ''), vendas.marketplace_id),
    pagamento         = COALESCE(NULLIF(EXCLUDED.pagamento,       ''), vendas.pagamento),
    moeda             = COALESCE(NULLIF(EXCLUDED.moeda,           ''), vendas.moeda),
    nome_contato      = COALESCE(NULLIF(EXCLUDED.nome_contato,    ''), vendas.nome_contato),
    email_contato     = COALESCE(NULLIF(EXCLUDED.email_contato,   ''), vendas.email_contato),
    doc_contato       = COALESCE(NULLIF(EXCLUDED.doc_contato,     ''), vendas.doc_contato),
    telefone_contato  = COALESCE(NULLIF(EXCLUDED.telefone_contato,''), vendas.telefone_contato),
    estado_contato    = COALESCE(NULLIF(EXCLUDED.estado_contato,  ''), vendas.estado_contato),
    pais_contato      = COALESCE(NULLIF(EXCLUDED.pais_contato,    ''), vendas.pais_contato),
    utm_source        = COALESCE(NULLIF(EXCLUDED.utm_source,      ''), vendas.utm_source),
    utm_campaign      = COALESCE(NULLIF(EXCLUDED.utm_campaign,    ''), vendas.utm_campaign),
    utm_medium        = COALESCE(NULLIF(EXCLUDED.utm_medium,      ''), vendas.utm_medium),
    utm_content       = COALESCE(NULLIF(EXCLUDED.utm_content,     ''), vendas.utm_content),
    rppc_checkout     = COALESCE(NULLIF(EXCLUDED.rppc_checkout,   ''), vendas.rppc_checkout),
    nome_oferta       = COALESCE(NULLIF(EXCLUDED.nome_oferta,     ''), vendas.nome_oferta),
    url_oferta        = COALESCE(NULLIF(EXCLUDED.url_oferta,      ''), vendas.url_oferta);

  UPDATE raw_vendas SET processed = true, processed_at = now() WHERE id = raw_id;

EXCEPTION WHEN OTHERS THEN
  UPDATE raw_vendas SET error = SQLERRM WHERE id = raw_id;
  RAISE;
END;
$function$;
