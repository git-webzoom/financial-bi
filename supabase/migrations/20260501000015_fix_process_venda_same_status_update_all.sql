-- Lógica de update no ON CONFLICT:
-- Mesmo status (ex: dois approved): atualiza TUDO — o último evento da Guru sempre vence.
-- Status diferente (ex: approved → refunded): atualiza só campos de estado,
-- preservando valores financeiros e dados do evento original.

CREATE OR REPLACE FUNCTION process_venda(raw_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_payload     jsonb;
  v_contato_id  uuid;
  v_telefone    text;
  v_rppc        text;
  v_produto_id  uuid;
  v_oferta_id   uuid;
  v_pptc        jsonb;
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
    NULL,
    (v_payload->'dates'->>'ordered_at')::timestamptz,
    (v_payload->'dates'->>'confirmed_at')::timestamptz,
    (v_payload->'dates'->>'canceled_at')::timestamptz,
    (v_payload->'dates'->>'warranty_until')::timestamptz,
    raw_id
  )
  ON CONFLICT (id) DO UPDATE SET
    status     = EXCLUDED.status,
    raw_id     = EXCLUDED.raw_id,
    updated_at = now(),
    -- Mesmo status: atualiza tudo (o último evento da Guru sempre tem os dados corretos)
    -- Status diferente: preserva dados originais, atualiza apenas campos de estado
    motivo_reembolso  = CASE WHEN vendas.status = EXCLUDED.status THEN EXCLUDED.motivo_reembolso  ELSE COALESCE(EXCLUDED.motivo_reembolso,  vendas.motivo_reembolso)  END,
    data_cancelamento = CASE WHEN vendas.status = EXCLUDED.status THEN EXCLUDED.data_cancelamento ELSE COALESCE(EXCLUDED.data_cancelamento, vendas.data_cancelamento) END,
    data_garantia     = CASE WHEN vendas.status = EXCLUDED.status THEN EXCLUDED.data_garantia     ELSE COALESCE(EXCLUDED.data_garantia,     vendas.data_garantia)     END,
    data_aprovacao    = CASE WHEN vendas.status = EXCLUDED.status THEN EXCLUDED.data_aprovacao    ELSE vendas.data_aprovacao    END,
    contato_id        = CASE WHEN vendas.status = EXCLUDED.status THEN EXCLUDED.contato_id        ELSE vendas.contato_id        END,
    produto_id        = CASE WHEN vendas.status = EXCLUDED.status THEN EXCLUDED.produto_id        ELSE vendas.produto_id        END,
    oferta_id         = CASE WHEN vendas.status = EXCLUDED.status THEN EXCLUDED.oferta_id         ELSE vendas.oferta_id         END,
    marketplace       = CASE WHEN vendas.status = EXCLUDED.status THEN EXCLUDED.marketplace       ELSE vendas.marketplace       END,
    marketplace_id    = CASE WHEN vendas.status = EXCLUDED.status THEN EXCLUDED.marketplace_id    ELSE vendas.marketplace_id    END,
    pagamento         = CASE WHEN vendas.status = EXCLUDED.status THEN EXCLUDED.pagamento         ELSE vendas.pagamento         END,
    parcelas          = CASE WHEN vendas.status = EXCLUDED.status THEN EXCLUDED.parcelas          ELSE vendas.parcelas          END,
    moeda             = CASE WHEN vendas.status = EXCLUDED.status THEN EXCLUDED.moeda             ELSE vendas.moeda             END,
    valor_venda       = CASE WHEN vendas.status = EXCLUDED.status THEN EXCLUDED.valor_venda       ELSE vendas.valor_venda       END,
    valor_liquido     = CASE WHEN vendas.status = EXCLUDED.status THEN EXCLUDED.valor_liquido     ELSE vendas.valor_liquido     END,
    valor_marketplace = CASE WHEN vendas.status = EXCLUDED.status THEN EXCLUDED.valor_marketplace ELSE vendas.valor_marketplace END,
    valor_afiliado    = CASE WHEN vendas.status = EXCLUDED.status THEN EXCLUDED.valor_afiliado    ELSE vendas.valor_afiliado    END,
    valor_desconto    = CASE WHEN vendas.status = EXCLUDED.status THEN EXCLUDED.valor_desconto    ELSE vendas.valor_desconto    END,
    valor_parcela     = CASE WHEN vendas.status = EXCLUDED.status THEN EXCLUDED.valor_parcela     ELSE vendas.valor_parcela     END,
    nome_contato      = CASE WHEN vendas.status = EXCLUDED.status THEN EXCLUDED.nome_contato      ELSE vendas.nome_contato      END,
    email_contato     = CASE WHEN vendas.status = EXCLUDED.status THEN EXCLUDED.email_contato     ELSE vendas.email_contato     END,
    doc_contato       = CASE WHEN vendas.status = EXCLUDED.status THEN EXCLUDED.doc_contato       ELSE vendas.doc_contato       END,
    telefone_contato  = CASE WHEN vendas.status = EXCLUDED.status THEN EXCLUDED.telefone_contato  ELSE vendas.telefone_contato  END,
    estado_contato    = CASE WHEN vendas.status = EXCLUDED.status THEN EXCLUDED.estado_contato    ELSE vendas.estado_contato    END,
    pais_contato      = CASE WHEN vendas.status = EXCLUDED.status THEN EXCLUDED.pais_contato      ELSE vendas.pais_contato      END,
    utm_source        = CASE WHEN vendas.status = EXCLUDED.status THEN EXCLUDED.utm_source        ELSE vendas.utm_source        END,
    utm_campaign      = CASE WHEN vendas.status = EXCLUDED.status THEN EXCLUDED.utm_campaign      ELSE vendas.utm_campaign      END,
    utm_medium        = CASE WHEN vendas.status = EXCLUDED.status THEN EXCLUDED.utm_medium        ELSE vendas.utm_medium        END,
    utm_content       = CASE WHEN vendas.status = EXCLUDED.status THEN EXCLUDED.utm_content       ELSE vendas.utm_content       END,
    rppc_checkout     = CASE WHEN vendas.status = EXCLUDED.status THEN EXCLUDED.rppc_checkout     ELSE vendas.rppc_checkout     END,
    nome_oferta       = CASE WHEN vendas.status = EXCLUDED.status THEN EXCLUDED.nome_oferta       ELSE vendas.nome_oferta       END,
    url_oferta        = CASE WHEN vendas.status = EXCLUDED.status THEN EXCLUDED.url_oferta        ELSE vendas.url_oferta        END,
    data_pedido       = CASE WHEN vendas.status = EXCLUDED.status THEN EXCLUDED.data_pedido       ELSE vendas.data_pedido       END;

  UPDATE raw_vendas
  SET processed = true, processed_at = now(), error = NULL
  WHERE id = raw_id;

EXCEPTION WHEN OTHERS THEN
  UPDATE raw_vendas SET error = SQLERRM WHERE id = raw_id;
END;
$$;
