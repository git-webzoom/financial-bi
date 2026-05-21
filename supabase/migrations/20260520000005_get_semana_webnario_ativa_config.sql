-- Recria get_semana_webnario_ativa para ativar a semana com base em data_inicio e data_evento.
--
-- Lógica anterior: usava janela de lookback calculada a partir de semana_config
--   (dias entre dia_inicio e dia_fim), olhando data_evento para trás.
--   Problema: só ativava a semana DEPOIS do evento, não antes.
--
-- Lógica nova: semana ativa = data_inicio <= now() <= data_evento
--   Isso respeita exatamente o período cadastrado em webinario_semanas,
--   ativando desde o início da semana (ex: Segunda 23:59) até o evento (Terça 23:59).

CREATE OR REPLACE FUNCTION public.get_semana_webnario_ativa()
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_agora timestamptz;
BEGIN
  v_agora := now();

  -- Semana ativa = aquela que já começou (data_inicio <= agora)
  -- e cujo evento ainda não passou (data_evento >= agora)
  RETURN (
    SELECT numero
    FROM   webinario_semanas
    WHERE  data_inicio <= v_agora
      AND  data_evento >= v_agora
    ORDER BY numero DESC
    LIMIT 1
  );
END;
$$;
