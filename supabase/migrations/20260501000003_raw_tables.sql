-- ============================================================
-- Tabelas RAW
-- ============================================================

-- raw_vendas
CREATE TABLE raw_vendas (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  payload         jsonb       NOT NULL,
  processed       boolean     NOT NULL DEFAULT false,
  processed_at    timestamptz,
  error           text,
  received_at     timestamptz NOT NULL DEFAULT now(),
  idempotency_key text        NOT NULL UNIQUE
);

-- raw_assinaturas
CREATE TABLE raw_assinaturas (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  payload         jsonb       NOT NULL,
  processed       boolean     NOT NULL DEFAULT false,
  processed_at    timestamptz,
  error           text,
  received_at     timestamptz NOT NULL DEFAULT now(),
  idempotency_key text        NOT NULL UNIQUE
);

-- raw_webnario
CREATE TABLE raw_webnario (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  payload         jsonb       NOT NULL,
  processed       boolean     NOT NULL DEFAULT false,
  processed_at    timestamptz,
  error           text,
  received_at     timestamptz NOT NULL DEFAULT now(),
  idempotency_key text        NOT NULL UNIQUE
);

-- raw_grupos_wpp
CREATE TABLE raw_grupos_wpp (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  payload         jsonb       NOT NULL,
  processed       boolean     NOT NULL DEFAULT false,
  processed_at    timestamptz,
  error           text,
  received_at     timestamptz NOT NULL DEFAULT now(),
  idempotency_key text        NOT NULL UNIQUE
);

-- raw_trafego
CREATE TABLE raw_trafego (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  payload       jsonb       NOT NULL,
  ad_account_id text        NOT NULL,
  date_ref      date        NOT NULL,
  processed     boolean     NOT NULL DEFAULT false,
  processed_at  timestamptz,
  error         text,
  job_run_id    uuid,
  received_at   timestamptz NOT NULL DEFAULT now()
);

-- raw_crm
CREATE TABLE raw_crm (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  payload       jsonb       NOT NULL,
  ac_contact_id text        NOT NULL,
  processed     boolean     NOT NULL DEFAULT false,
  processed_at  timestamptz,
  error         text,
  job_run_id    uuid,
  received_at   timestamptz NOT NULL DEFAULT now()
);
