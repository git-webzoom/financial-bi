-- ============================================================
-- Função upsert_contato
-- Busca por email (lowercase/trim).
-- Se não existe: insere. Se existe: atualiza apenas campos NULL.
-- Retorna o id do contato.
-- ============================================================

CREATE OR REPLACE FUNCTION upsert_contato(
  p_email                 text,
  p_nome                  text        DEFAULT NULL,
  p_telefone              text        DEFAULT NULL,
  p_doc                   text        DEFAULT NULL,
  p_estado                text        DEFAULT NULL,
  p_pais                  char(2)     DEFAULT NULL,
  p_ac_contact_id         text        DEFAULT NULL,
  p_primeira_captura      text        DEFAULT NULL,
  p_data_primeira_captura timestamptz DEFAULT NULL,
  p_ultima_captura        text        DEFAULT NULL,
  p_data_ultima_captura   timestamptz DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email text;
  v_id    uuid;
BEGIN
  v_email := lower(trim(p_email));

  SELECT id INTO v_id FROM contatos WHERE email = v_email;

  IF NOT FOUND THEN
    INSERT INTO contatos (
      email, nome, telefone, doc, estado, pais,
      ac_contact_id,
      primeira_captura, data_primeira_captura,
      ultima_captura,  data_ultima_captura
    ) VALUES (
      v_email, p_nome, p_telefone, p_doc, p_estado, p_pais,
      p_ac_contact_id,
      p_primeira_captura, p_data_primeira_captura,
      p_ultima_captura,   p_data_ultima_captura
    )
    RETURNING id INTO v_id;
  ELSE
    -- Atualiza apenas campos que estão NULL no registro atual
    UPDATE contatos SET
      nome                  = COALESCE(nome,                  p_nome),
      telefone              = COALESCE(telefone,              p_telefone),
      doc                   = COALESCE(doc,                   p_doc),
      estado                = COALESCE(estado,                p_estado),
      pais                  = COALESCE(pais,                  p_pais),
      ac_contact_id         = COALESCE(ac_contact_id,         p_ac_contact_id),
      primeira_captura      = COALESCE(primeira_captura,      p_primeira_captura),
      data_primeira_captura = COALESCE(data_primeira_captura, p_data_primeira_captura),
      ultima_captura        = COALESCE(ultima_captura,        p_ultima_captura),
      data_ultima_captura   = COALESCE(data_ultima_captura,   p_data_ultima_captura),
      updated_at            = now()
    WHERE id = v_id;
  END IF;

  RETURN v_id;
END;
$$;
