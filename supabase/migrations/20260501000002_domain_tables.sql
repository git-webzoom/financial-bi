-- ============================================================
-- TABELAS DE DOMÍNIO
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- produtos
CREATE TABLE produtos (
  id              uuid        PRIMARY KEY,
  marketplace_id  text        NOT NULL,
  marketplace     text        NOT NULL,
  nome            text        NOT NULL,
  ativo           boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_produtos_updated_at
  BEFORE UPDATE ON produtos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ofertas
CREATE TABLE ofertas (
  id                uuid        PRIMARY KEY,
  produto_id        uuid        NOT NULL REFERENCES produtos(id),
  nome              text        NOT NULL,
  friendly_url      text,
  checkout_url      text,
  valor             numeric(10,2) NOT NULL,
  moeda             char(3)     NOT NULL DEFAULT 'BRL',
  ativa             boolean     NOT NULL DEFAULT true,
  pagamentos        text[],
  parcelas_default  int,
  max_sem_juros     int,
  funil             text,
  mg_created_at     timestamptz,
  mg_updated_at     timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_ofertas_updated_at
  BEFORE UPDATE ON ofertas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- contatos
CREATE TABLE contatos (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 text        NOT NULL UNIQUE,
  nome                  text,
  telefone              text,
  doc                   text,
  estado                text,
  pais                  char(2),
  ac_contact_id         text,
  primeira_captura      text,
  data_primeira_captura timestamptz,
  ultima_captura        text,
  data_ultima_captura   timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contatos_email_format CHECK (email = lower(trim(email)))
);

CREATE INDEX idx_contatos_email         ON contatos(email);
CREATE INDEX idx_contatos_telefone      ON contatos(telefone);
CREATE INDEX idx_contatos_doc           ON contatos(doc);
CREATE INDEX idx_contatos_ac_contact_id ON contatos(ac_contact_id);

CREATE TRIGGER trg_contatos_updated_at
  BEFORE UPDATE ON contatos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- vendas
CREATE TABLE vendas (
  id                  uuid        PRIMARY KEY,
  contato_id          uuid        REFERENCES contatos(id),
  produto_id          uuid        REFERENCES produtos(id),
  oferta_id           uuid        REFERENCES ofertas(id),
  marketplace         text        NOT NULL,
  marketplace_id      text,
  status              text        NOT NULL,
  pagamento           text,
  parcelas            int,
  moeda               char(3)     NOT NULL DEFAULT 'BRL',
  valor_venda         numeric(10,2),
  valor_liquido       numeric(10,2),
  valor_marketplace   numeric(10,2),
  valor_afiliado      numeric(10,2),
  valor_desconto      numeric(10,2),
  valor_parcela       numeric(10,2),
  nome_contato        text,
  email_contato       text,
  doc_contato         text,
  telefone_contato    text,
  estado_contato      text,
  pais_contato        char(2),
  utm_source          text,
  utm_campaign        text,
  utm_medium          text,
  utm_content         text,
  rppc_checkout       text,
  nome_oferta         text,
  url_oferta          text,
  motivo_reembolso    text,
  assinatura_ciclo    text,
  data_pedido         timestamptz,
  data_aprovacao      timestamptz,
  data_cancelamento   timestamptz,
  data_garantia       timestamptz,
  raw_id              uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vendas_status_check CHECK (
    status IN ('approved', 'refunded', 'chargeback', 'cancelled', 'pending')
  )
);

CREATE INDEX idx_vendas_contato_id    ON vendas(contato_id);
CREATE INDEX idx_vendas_produto_id    ON vendas(produto_id);
CREATE INDEX idx_vendas_oferta_id     ON vendas(oferta_id);
CREATE INDEX idx_vendas_status        ON vendas(status);
CREATE INDEX idx_vendas_data_aprovacao ON vendas(data_aprovacao);
CREATE INDEX idx_vendas_email_contato  ON vendas(email_contato);
CREATE INDEX idx_vendas_utm_campaign   ON vendas(utm_campaign);

CREATE TRIGGER trg_vendas_updated_at
  BEFORE UPDATE ON vendas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- assinaturas
CREATE TABLE assinaturas (
  id                    uuid        PRIMARY KEY,
  contato_id            uuid        REFERENCES contatos(id),
  produto_id            uuid        REFERENCES produtos(id),
  oferta_id             uuid        REFERENCES ofertas(id),
  status                text        NOT NULL,
  email_contato         text,
  doc_contato           text,
  nome_assinatura       text,
  quantidade_cobrancas  int,
  cobrada_cada_x_dias   int,
  ultimo_valor          numeric(10,2),
  ultimo_valor_liquido  numeric(10,2),
  motivo_cancelamento   text,
  pagamento             text,
  data_inicio           timestamptz,
  data_cancelamento     timestamptz,
  data_inicio_ciclo     timestamptz,
  data_fim_ciclo        timestamptz,
  proximo_ciclo         timestamptz,
  raw_id                uuid,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_assinaturas_updated_at
  BEFORE UPDATE ON assinaturas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- trafego
CREATE TABLE trafego (
  id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id           text          NOT NULL,
  campaign_name           text,
  adset_name              text,
  ad_name                 text,
  date_ref                date          NOT NULL,
  impressions             bigint,
  link_clicks             bigint,
  landing_page_views      bigint,
  reach                   bigint,
  frequency               numeric(6,2),
  amount_spent            numeric(12,2),
  leads                   bigint,
  purchases               bigint,
  registrations_completed bigint,
  checkouts_initiated     bigint,
  adds_to_cart            bigint,
  thruplays               bigint,
  video_watches_25        bigint,
  video_watches_50        bigint,
  video_watches_75        bigint,
  video_watches_95        bigint,
  video_watches_100       bigint,
  gender                  text,
  raw_id                  uuid,
  created_at              timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT trafego_unique_row UNIQUE (
    ad_account_id, campaign_name, adset_name, ad_name, date_ref, gender
  )
);

CREATE INDEX idx_trafego_date_ref      ON trafego(date_ref);
CREATE INDEX idx_trafego_campaign_name ON trafego(campaign_name);
CREATE INDEX idx_trafego_ad_account_id ON trafego(ad_account_id);

-- crm
CREATE TABLE crm (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contato_id            uuid        REFERENCES contatos(id),
  ac_contact_id         text        NOT NULL UNIQUE,
  email                 text        NOT NULL,
  nome                  text,
  telefone              text,
  utm_source            text,
  utm_campaign          text,
  utm_medium            text,
  utm_content           text,
  utm_term              text,
  utm_id                text,
  data_cadastro         timestamptz,
  ip                    text,
  dispositivo           text,
  estado                text,
  temperatura           text,
  limite_engajamento    text,
  emails_enviados       int,
  emails_abertos        int,
  data_abertura_email   timestamptz,
  ultimo_clique         timestamptz,
  cliques_email         int,
  ultimo_envio_email    timestamptz,
  ultima_interacao      timestamptz,
  tags                  text[],
  nome_evento           text,
  data_evento           timestamptz,
  numeros_recadastro    int,
  raw_id                uuid,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_ac_contact_id ON crm(ac_contact_id);
CREATE INDEX idx_crm_email         ON crm(email);
CREATE INDEX idx_crm_contato_id    ON crm(contato_id);
CREATE INDEX idx_crm_tags          ON crm USING GIN(tags);

CREATE TRIGGER trg_crm_updated_at
  BEFORE UPDATE ON crm
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- webnario
CREATE TABLE webnario (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contato_id  uuid        REFERENCES contatos(id),
  nome        text,
  email       text        NOT NULL,
  telefone    text,
  metrica     text        NOT NULL,
  id_metrica  text        NOT NULL,
  data_evento timestamptz NOT NULL,
  raw_id      uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_webnario_email      ON webnario(email);
CREATE INDEX idx_webnario_id_metrica ON webnario(id_metrica);
CREATE INDEX idx_webnario_metrica    ON webnario(metrica);
CREATE INDEX idx_webnario_data_evento ON webnario(data_evento);
CREATE INDEX idx_webnario_contato_id ON webnario(contato_id);

-- grupos_wpp
CREATE TABLE grupos_wpp (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contato_id  uuid        REFERENCES contatos(id),
  numero      text        NOT NULL,
  grupo       text        NOT NULL,
  campanha    text,
  posicao     int,
  evento      text        NOT NULL,
  data_evento timestamptz NOT NULL,
  raw_id      uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_grupos_wpp_numero      ON grupos_wpp(numero);
CREATE INDEX idx_grupos_wpp_grupo       ON grupos_wpp(grupo);
CREATE INDEX idx_grupos_wpp_campanha    ON grupos_wpp(campanha);
CREATE INDEX idx_grupos_wpp_data_evento ON grupos_wpp(data_evento);
CREATE INDEX idx_grupos_wpp_contato_id  ON grupos_wpp(contato_id);
