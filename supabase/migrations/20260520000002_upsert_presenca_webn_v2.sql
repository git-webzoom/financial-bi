-- Recria upsert_presenca_webn apontando para webinario_presencas (separada de webinario_inscritos)
-- Remove versão antiga com 4 parâmetros (código morto)
DROP FUNCTION IF EXISTS public.upsert_presenca_webn(text, text, text, int);

CREATE OR REPLACE FUNCTION public.upsert_presenca_webn(
  p_email         text,
  p_nome          text,
  p_telefone      text,
  p_tag           text,
  p_numero_semana int
)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_contato_id uuid;
  v_agora      timestamptz := now();
  v_eh_pitch   boolean := (p_tag IS DISTINCT FROM 'Acessou');
BEGIN
  v_contato_id := upsert_contato(
    p_email    := lower(trim(p_email)),
    p_nome     := p_nome,
    p_telefone := NULLIF(trim(p_telefone), 'null')
  );

  INSERT INTO webinario_presencas (contato_id, numero_semana, data_acesso, viu_pitch, data_pitch)
  VALUES (
    v_contato_id, p_numero_semana, v_agora,
    v_eh_pitch,
    CASE WHEN v_eh_pitch THEN v_agora ELSE NULL END
  )
  ON CONFLICT (contato_id, numero_semana) DO UPDATE SET
    viu_pitch  = CASE WHEN v_eh_pitch THEN true ELSE webinario_presencas.viu_pitch END,
    data_pitch = CASE WHEN v_eh_pitch AND webinario_presencas.data_pitch IS NULL THEN v_agora ELSE webinario_presencas.data_pitch END;
END;
$$;
