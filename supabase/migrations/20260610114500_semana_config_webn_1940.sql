-- Antecipa a virada da semana de webinário/vendas (entidade 'webn') de 20:00 para 19:40 (BRT).
--
-- Motivo: o webinário ao vivo recebe acessos a partir de ~19:56, mas a régua 'webn' virava
-- só às 20:00 -> os primeiros minutos de acessos caíam na semana que estava acabando.
-- Front e webhook leem a MESMA função get_semana_webnario_ativa() (que lê semana_config('webn')
-- em tempo real), então antecipar o horário faz os dois virarem juntos, antes do ao vivo começar.
--
-- Timing seguro na terça: 19:30 o cron cria a régua master da semana nova (régua 'captacao'),
-- 19:40 a 'webn' vira (régua já existe -> sem race), 19:56 os acessos caem na semana nova.
-- hora_fim = 19:39 (início - 1 min), padrão das demais entidades, para o período fechar certo
-- em get_periodo_semana('webn').
--
-- Obs: a aba Configurações -> Semanas faz o mesmo UPSERT em semana_config; este UPDATE apenas
-- versiona/documenta a mudança no Git. Afeta também a régua de Vendas (mesma entidade 'webn').

UPDATE semana_config
SET hora_inicio = '19:40:00',
    hora_fim    = '19:39:00',
    updated_at  = now()
WHERE entidade = 'webn';
