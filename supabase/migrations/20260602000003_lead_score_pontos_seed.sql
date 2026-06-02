-- Lead Score WEBN — seed da tabela de pontos (Fase 2)
--
-- Textos EXATOS do formulário (conferidos na seção 5 de docs/PLANO-LEAD-SCORE.md).
-- variavel = chave normalizada (saída do MAP da Edge Function webhook-lead-score
-- e chave do breakdown da RPC calcular_lead_score).
-- Idempotente: ON CONFLICT atualiza os pontos (permite re-score sem recriar a tabela).

INSERT INTO lead_score_pontos (variavel, resposta, pontos) VALUES
  -- renda (campo `renda`)
  ('renda', 'Acima de R$20.000',   25),
  ('renda', 'R$5.001 a R$10.000',  18),
  ('renda', 'R$10.001 a R$20.000', 16),
  ('renda', 'R$3.001 a R$5.000',   10),
  ('renda', 'R$1.501 a R$3.000',    0),
  ('renda', 'Menos de R$1.500',    -8),

  -- escolaridade (campo `escolaridade`)
  ('escolaridade', 'Pós-Graduação ou Mestrado', 20),
  ('escolaridade', 'Graduação Completa',        10),
  ('escolaridade', 'Graduação Incompleta',       4),
  ('escolaridade', 'Até Ensino Médio Completo',  0),

  -- profissao (campo `profissional`)
  ('profissao', 'Empresário',           18),
  ('profissao', 'Servidor Público',     15),
  ('profissao', 'Aposentado',            5),
  ('profissao', 'CLT / Colaborador PJ',  4),
  ('profissao', 'Autônomo',              3),
  ('profissao', 'Desempregado',        -10),

  -- conhece (campo `tempo_tasso`)
  ('conhece', 'Acima de 1 ano',                20),
  ('conhece', '6 a 12 meses',                  18),
  ('conhece', '3 a 6 meses',                   10),
  ('conhece', '1 a 3 meses',                    5),
  ('conhece', 'Acabei de conhecer por um anúncio', 0),

  -- cripto (campo `investe_cripto`)
  ('cripto', 'Sim, já invisto em cripto', 20),
  ('cripto', 'Não, mas faço outros investimentos (Renda Fixa, Bolsa de Valores, etc)', 8),
  ('cripto', 'Não, também não faço outros investimentos ainda', 0),

  -- valor (campo `valor_investido`)
  ('valor', 'R$ 10.000 a R$ 20.000',    18),
  ('valor', 'R$ 20.000 a R$ 50.000',    16),
  ('valor', 'R$ 1.000 a R$ 10.000',     14),
  ('valor', 'R$ 50.000 a R$ 150.000',   12),
  ('valor', 'Menos de R$ 1.000',         4),
  ('valor', 'R$ 150.000 a R$ 500.000',  -5),  -- decisão confirmada (coef. regressão ~-1.23)
  ('valor', 'Acima de R$ 500.000',      -5),

  -- idade (campo `idade`)
  ('idade', 'Entre 56 e 65 anos', 14),
  ('idade', 'Entre 46 e 55 anos', 12),
  ('idade', 'Acima de 65 anos',    8),
  ('idade', 'Entre 36 e 45 anos',  6),
  ('idade', 'Entre 26 e 35 anos',  0),
  ('idade', 'Entre 18 e 25 anos', -15),

  -- disponivel_mes (campo `disponivel_mes`)
  ('disponivel_mes', 'Acima de R$ 3.000',    22),
  ('disponivel_mes', 'R$ 1.000 a R$ 3.000',  18),
  ('disponivel_mes', 'R$ 500 a R$ 1.000',    12),
  ('disponivel_mes', 'R$ 100 a R$ 500',       5),
  ('disponivel_mes', 'Menos de R$ 100',       0),

  -- dificuldade (campo `dificuldade_cripto`)
  ('dificuldade', 'Falta de conhecimento técnico', 10),
  ('dificuldade', 'Falta de confiança no mercado',  5),
  ('dificuldade', 'Falta de experiência',           3),
  ('dificuldade', 'Falta de capital',              -3),

  -- objetivo (campo `objetivo_cripto`)
  ('objetivo', 'Construir patrimônio para minha família',          8),
  ('objetivo', 'Ter liberdade financeira e viver de renda',        5),
  ('objetivo', 'Aprender a investir com segurança e autonomia',    5),
  ('objetivo', 'Ganhar dinheiro rápido e mudar de vida',           3),
  ('objetivo', 'Ter uma renda extra para complementar o salário',  3)
ON CONFLICT (variavel, resposta) DO UPDATE SET pontos = EXCLUDED.pontos;
