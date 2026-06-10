-- Repointa o FK de webinario_presencas.numero_semana para a régua MASTER
-- (webinario_semanas), que é criada automaticamente pelo cron a cada semana.
--
-- Causa raiz do bug recorrente "webinário perde os primeiros acessos toda terça (erro 500)":
-- o FK apontava para webinario_semanas_presencas (régua paralela/legada), cuja criação
-- automática virou no-op em 02/06 (ensure_semana_webnario_existe). Toda semana nova nascia
-- sem linha nessa tabela -> upsert_presenca_webn violava o FK -> webhook-hotwebnar dava 500
-- e o acesso era perdido. webinario_semanas (master) sempre tem a semana nova.
--
-- Pré-condição verificada no banco real: 100% das presenças (172-177) têm numero_semana
-- presente em webinario_semanas (0 órfãs). webinario_inscritos.numero_semana já aponta
-- para a master (não precisa mexer).

BEGIN;

-- Aborta se houver qualquer presença órfã contra a régua master.
DO $$
DECLARE v_orfas int;
BEGIN
  SELECT count(*) INTO v_orfas
  FROM webinario_presencas wp
  WHERE NOT EXISTS (SELECT 1 FROM webinario_semanas ws WHERE ws.numero = wp.numero_semana);
  IF v_orfas > 0 THEN
    RAISE EXCEPTION 'Abortado: % presencas orfas contra webinario_semanas', v_orfas;
  END IF;
END $$;

ALTER TABLE webinario_presencas
  DROP CONSTRAINT webinario_presencas_numero_semana_fkey;

ALTER TABLE webinario_presencas
  ADD CONSTRAINT webinario_presencas_numero_semana_fkey
  FOREIGN KEY (numero_semana) REFERENCES webinario_semanas(numero);

COMMIT;
