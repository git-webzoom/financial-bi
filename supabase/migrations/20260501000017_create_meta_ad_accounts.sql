CREATE TABLE meta_ad_accounts (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id       text        NOT NULL UNIQUE,
  nome             text        NOT NULL,
  ativo            boolean     NOT NULL DEFAULT true,
  last_sync_at     timestamptz,
  last_sync_status text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE meta_ad_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meta_ad_accounts_select" ON meta_ad_accounts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "meta_ad_accounts_insert" ON meta_ad_accounts
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil = 'admin')
  );

CREATE POLICY "meta_ad_accounts_update" ON meta_ad_accounts
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil = 'admin')
  );

CREATE POLICY "meta_ad_accounts_delete" ON meta_ad_accounts
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND perfil = 'admin')
  );

CREATE OR REPLACE FUNCTION update_meta_ad_accounts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_meta_ad_accounts_updated_at
  BEFORE UPDATE ON meta_ad_accounts
  FOR EACH ROW EXECUTE FUNCTION update_meta_ad_accounts_updated_at();
