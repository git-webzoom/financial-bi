-- Antecipa a virada da semana de webinário/vendas (entidade 'webn') de 19:40 para 19:00 (BRT).
--
-- Motivo: mesmo com a virada às 19:40 (migration 20260610114500), acessos ao vivo que chegam
-- ANTES desse horário na terça eram carimbados na semana ANTERIOR — bug de ATRIBUIÇÃO (não crash;
-- o fix de FK/500 de 2026-06-10 segue firme). get_semana_webnario_ativa() é lida tanto pelo
-- webhook-hotwebnar (AO GRAVAR a presença) quanto pelo /webnario (AO LER), então ambos só viravam
-- às 19:40. Prova ao vivo em 2026-07-07: uma presença das 18:47 caiu na semana 179 em vez da 180
-- (evento do dia). Antecipar para 19:00 dá folga confortável antes do início real do ao vivo (~19:56).
--
-- Front e webhook leem a MESMA função get_semana_webnario_ativa() (que lê semana_config('webn')
-- em tempo real, sem cache/ISR), então antecipar o horário faz os dois virarem juntos.
-- hora_fim = 18:59 (início - 1 min), padrão das demais entidades, para o período fechar certo
-- em get_periodo_semana('webn').
--
-- ATENÇÃO: a entidade 'webn' também rege a régua de VENDAS (get_periodo_semana('webn') /
-- listar_semanas_vendas). A virada da semana de Vendas passa igualmente para terça 19:00 —
-- decisão do responsável (mesma natureza da mudança 20:00->19:40 de 2026-06-10).
--
-- Obs: a aba Configurações -> Semanas faz o mesmo UPSERT em semana_config; este UPDATE apenas
-- versiona/documenta a mudança no Git.

UPDATE semana_config
SET hora_inicio = '19:00:00',
    hora_fim    = '18:59:00',
    updated_at  = now()
WHERE entidade = 'webn';
