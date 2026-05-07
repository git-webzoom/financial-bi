-- ============================================================
-- Tabelas de sistema
-- ============================================================

-- profiles
CREATE TABLE profiles (
  id         uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome       text        NOT NULL,
  perfil     text        NOT NULL,
  ativo      boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_perfil_check CHECK (perfil IN ('admin', 'visualizador'))
);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, perfil)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    'visualizador'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- integration_tokens
CREATE TABLE integration_tokens (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  integration        text        NOT NULL UNIQUE,
  vault_key          text        NOT NULL,
  expires_at         timestamptz,
  meta_ad_account_id text,
  ativo              boolean     NOT NULL DEFAULT true,
  last_sync_at       timestamptz,
  last_sync_status   text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_integration_tokens_updated_at
  BEFORE UPDATE ON integration_tokens
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- integration_job_runs
CREATE TABLE integration_job_runs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  integration      text        NOT NULL,
  status           text        NOT NULL DEFAULT 'running',
  started_at       timestamptz NOT NULL DEFAULT now(),
  finished_at      timestamptz,
  records_fetched  int,
  records_inserted int,
  records_error    int,
  date_range_start date,
  date_range_end   date,
  error_message    text,
  watermark        timestamptz
);

-- integration_alerts
CREATE TABLE integration_alerts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  integration  text        NOT NULL,
  tipo         text        NOT NULL,
  mensagem     text        NOT NULL,
  resolvido    boolean     NOT NULL DEFAULT false,
  resolvido_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- import_historico
CREATE TABLE import_historico (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo              text        NOT NULL,
  arquivo_nome      text        NOT NULL,
  storage_path      text        NOT NULL,
  status            text        NOT NULL DEFAULT 'uploaded',
  total_linhas      int,
  linhas_inseridas  int,
  linhas_duplicadas int,
  linhas_erro       int,
  erro_detalhes     jsonb,
  importado_por     uuid        NOT NULL REFERENCES auth.users(id),
  started_at        timestamptz,
  finished_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
