-- Cria tabela separada para presença ao vivo (fonte: webhook Hotwebnar)
-- webinario_inscritos fica exclusivo para leads do job-activecampaign-webn (tag AC)
CREATE TABLE IF NOT EXISTS webinario_presencas (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contato_id    uuid        NOT NULL REFERENCES contatos(id),
  numero_semana int         NOT NULL REFERENCES webinario_semanas(numero),
  data_acesso   timestamptz NOT NULL DEFAULT now(),
  viu_pitch     boolean     NOT NULL DEFAULT false,
  data_pitch    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contato_id, numero_semana)
);

-- Migra registros que já têm data_acesso preenchida
INSERT INTO webinario_presencas (contato_id, numero_semana, data_acesso, viu_pitch, data_pitch, created_at)
SELECT contato_id, numero_semana, data_acesso, viu_pitch, data_pitch, created_at
FROM webinario_inscritos
WHERE data_acesso IS NOT NULL
ON CONFLICT (contato_id, numero_semana) DO NOTHING;

-- Remove colunas de presença da tabela CRM
ALTER TABLE webinario_inscritos DROP COLUMN IF EXISTS data_acesso;
ALTER TABLE webinario_inscritos DROP COLUMN IF EXISTS viu_pitch;
ALTER TABLE webinario_inscritos DROP COLUMN IF EXISTS data_pitch;
