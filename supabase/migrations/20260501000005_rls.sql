-- ============================================================
-- Row Level Security
-- ============================================================

-- Função auxiliar: retorna o perfil do usuário autenticado
CREATE OR REPLACE FUNCTION get_user_perfil()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT perfil FROM public.profiles WHERE id = auth.uid();
$$;

-- ------------------------------------------------------------
-- Habilitar RLS em todas as tabelas
-- ------------------------------------------------------------
ALTER TABLE produtos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ofertas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE contatos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE assinaturas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE trafego              ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE webnario             ENABLE ROW LEVEL SECURITY;
ALTER TABLE grupos_wpp           ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_vendas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_assinaturas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_webnario         ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_grupos_wpp       ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_trafego          ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_crm              ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_tokens   ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_alerts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_historico     ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles             ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- Tabelas de domínio: SELECT autenticado | INSERT/UPDATE service_role | DELETE admin
-- ------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['produtos','ofertas','contatos','vendas','assinaturas','trafego','crm','webnario','grupos_wpp']
  LOOP
    EXECUTE format('CREATE POLICY "select_autenticado"  ON %I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "insert_service_role" ON %I FOR INSERT TO service_role WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY "update_service_role" ON %I FOR UPDATE TO service_role USING (true) WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY "delete_admin"        ON %I FOR DELETE TO authenticated USING (get_user_perfil() = ''admin'')', t);
  END LOOP;
END;
$$;

-- ------------------------------------------------------------
-- Tabelas RAW: SELECT admin | INSERT/UPDATE service_role | DELETE negado
-- ------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['raw_vendas','raw_assinaturas','raw_webnario','raw_grupos_wpp','raw_trafego','raw_crm']
  LOOP
    EXECUTE format('CREATE POLICY "select_admin"        ON %I FOR SELECT TO authenticated USING (get_user_perfil() = ''admin'')', t);
    EXECUTE format('CREATE POLICY "insert_service_role" ON %I FOR INSERT TO service_role WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY "update_service_role" ON %I FOR UPDATE TO service_role USING (true) WITH CHECK (true)', t);
  END LOOP;
END;
$$;

-- ------------------------------------------------------------
-- integration_tokens e integration_alerts: apenas admin
-- ------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['integration_tokens','integration_alerts']
  LOOP
    EXECUTE format(
      'CREATE POLICY "admin_all" ON %I TO authenticated USING (get_user_perfil() = ''admin'') WITH CHECK (get_user_perfil() = ''admin'')',
      t
    );
  END LOOP;
END;
$$;

-- ------------------------------------------------------------
-- integration_job_runs: SELECT admin | INSERT/UPDATE service_role
-- ------------------------------------------------------------
CREATE POLICY "select_admin"        ON integration_job_runs FOR SELECT TO authenticated USING (get_user_perfil() = 'admin');
CREATE POLICY "insert_service_role" ON integration_job_runs FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "update_service_role" ON integration_job_runs FOR UPDATE TO service_role USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- import_historico: SELECT próprio + admin | INSERT autenticado
-- ------------------------------------------------------------
CREATE POLICY "select_proprio_ou_admin" ON import_historico
  FOR SELECT TO authenticated
  USING (importado_por = auth.uid() OR get_user_perfil() = 'admin');

CREATE POLICY "insert_autenticado" ON import_historico
  FOR INSERT TO authenticated
  WITH CHECK (importado_por = auth.uid());

-- ------------------------------------------------------------
-- profiles: SELECT próprio | UPDATE admin
-- ------------------------------------------------------------
CREATE POLICY "select_proprio" ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "update_admin" ON profiles
  FOR UPDATE TO authenticated
  USING (get_user_perfil() = 'admin')
  WITH CHECK (get_user_perfil() = 'admin');
