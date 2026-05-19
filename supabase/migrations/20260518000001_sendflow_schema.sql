-- Formaliza sendflow_campanhas (existia no banco sem migration documentada)
CREATE TABLE IF NOT EXISTS sendflow_campanhas (
  id               text        PRIMARY KEY,
  nome             text,
  total_grupos     int,
  total_membros    int,
  ativo            boolean,
  monitorada       boolean     NOT NULL DEFAULT false,
  coletar_metricas boolean     NOT NULL DEFAULT false,
  raw              jsonb,
  synced_at        timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Garante coluna coletar_metricas caso a tabela já existisse antes desta migration
ALTER TABLE sendflow_campanhas ADD COLUMN IF NOT EXISTS coletar_metricas boolean NOT NULL DEFAULT false;

-- Formaliza sendflow_grupos (existia no banco sem migration documentada)
CREATE TABLE IF NOT EXISTS sendflow_grupos (
  id            text        PRIMARY KEY,
  campanha_id   text        NOT NULL REFERENCES sendflow_campanhas(id) ON DELETE CASCADE,
  nome          text,
  link          text,
  invite_code   text,
  total_membros int,
  count         int,
  grupo_cheio   boolean,
  gid           text,
  ativo         boolean,
  raw           jsonb,
  synced_at     timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Recria sendflow_metricas (foi dropada no cleanup de 20260515000002)
CREATE TABLE IF NOT EXISTS sendflow_metricas (
  campanha_id  text        NOT NULL REFERENCES sendflow_campanhas(id) ON DELETE CASCADE,
  data         date        NOT NULL,
  adicionados  int         NOT NULL DEFAULT 0,
  removidos    int         NOT NULL DEFAULT 0,
  cliques      int         NOT NULL DEFAULT 0,
  synced_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campanha_id, data)
);
